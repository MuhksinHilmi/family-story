import { jwtVerify } from 'jose';
import { NextRequest } from 'next/server';
import pool from '@/lib/db_helper'; // for resolving integer user id from uuid

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is not set in environment variables');
}

const secret = new TextEncoder().encode(JWT_SECRET);

/**
 * Verifies JWT from Authorization header + checks timestamp for anti-spam.
 * Returns decoded payload if valid.
 */
export async function verifyAuth(request: NextRequest) {
  // 1. Get Authorization header
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { success: false as const, error: 'Missing or invalid Authorization header' };
  }

  const token = authHeader.replace('Bearer ', '');

  // 2. Timestamp protection against spam bots (rapid repeated calls)
  const timestampHeader = request.headers.get('x-timestamp');
  if (!timestampHeader) {
    return { success: false as const, error: 'Missing X-Timestamp header' };
  }

  const clientTimestamp = parseInt(timestampHeader, 10);
  const now = Date.now();

  // Allow 60 seconds clock skew / network delay
  const maxSkew = 60 * 1000;
  if (isNaN(clientTimestamp) || Math.abs(now - clientTimestamp) > maxSkew) {
    return { success: false as const, error: 'Timestamp expired or invalid' };
  }

  // 3. Verify JWT
  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ['HS256'],
    });

    // You can add more claims validation here (exp, iat, etc.)
    if (!payload.sub) {
      return { success: false as const, error: 'Invalid token payload' };
    }

    const userUuid = payload.sub as string;

    // Resolve local integer user ID from UUID (needed for family_members, etc.)
    // Also fetch the node_id via join to nodes table
    let localUserId: number | null = null;
    let nodeId: number | null = null;
    let nuclearFamilyId: number | null = null;
    try {
      const userRes = await pool.query(
        'SELECT u.id, n.id as node_id FROM users u LEFT JOIN nodes n ON n.user_id = u.id WHERE u.uuid = $1',
        [userUuid]
      );
      if (userRes.rows.length > 0) {
        localUserId = userRes.rows[0].id;
        nodeId = userRes.rows[0].node_id;
        
        // Get nuclear family id from node (active membership only)
        if (nodeId) {
          const nfRes = await pool.query(
            'SELECT nuclear_family_id FROM nuclear_family_memberships WHERE node_id = $1 AND left_at IS NULL LIMIT 1',
            [nodeId]
          );
          if (nfRes.rows.length > 0) {
            nuclearFamilyId = nfRes.rows[0].nuclear_family_id;
          }
        }
      }
    } catch (dbErr) {
      console.error('Failed to resolve user id from uuid in auth:', dbErr);
    }

    if (!localUserId) {
      return { success: false as const, error: 'User not found in local database' };
    }

    return {
      success: true as const,
      userId: localUserId,      // integer local DB ID (used by family_members, chat_rooms logic, etc.)
      userUuid: userUuid,       // UUID from JWT (used as sender_id in Supabase + auth.uid())
      nuclearFamilyId,          // nuclear family ID for halaqah invites
      payload,
    };
  } catch (err) {
    return { success: false as const, error: 'Invalid or expired token' };
  }
}

/**
 * Helper for protected route handlers.
 * Returns 401 response if auth fails.
 */
export async function requireAuth(request: NextRequest) {
  const result = await verifyAuth(request);

  if (!result.success) {
    return {
      error: Response.json({ error: result.error }, { status: 401 }),
    };
  }

  return { 
    userId: result.userId,     // integer local ID
    userUuid: result.userUuid, // UUID for Supabase
    nuclearFamilyId: result.nuclearFamilyId, // nuclear family ID
    payload: result.payload 
  };
}
