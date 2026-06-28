import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db_helper';
import { requireAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const { nuclearFamilyId } = auth;
    const url = new URL(request.url);
    const status = url.searchParams.get('status') || 'pending';

    const client = await pool.connect();

    try {
      // Get halaqah join requests where user is admin of the halaqah
      const requestsRes = await client.query(
        `SELECT hm.id, hm.halaqah_id, hm.node_id, hm.status as request_status, hm.joined_at,
                n.full_name, n.photo_url, nf.name as family_name,
                h.name as halaqah_name
         FROM halaqah_members hm
         JOIN nodes n ON n.id = hm.node_id
         JOIN nuclear_families nf ON nf.id = n.current_nuclear_family_id
         JOIN halaqahs h ON h.id = hm.halaqah_id
         WHERE h.nuclear_family_id = $1
         AND hm.status = $2
         ORDER BY hm.joined_at DESC`,
        [nuclearFamilyId, status]
      );

      const requests = requestsRes.rows.map((row: any) => ({
        id: row.id,
        halaqah_id: row.halaqah_id,
        halaqah_name: row.halaqah_name,
        node_id: row.node_id,
        full_name: row.full_name,
        photo_url: row.photo_url,
        family_name: row.family_name,
        status: row.request_status,
        joined_at: row.joined_at,
      }));

      return NextResponse.json({ requests });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Get circle-family requests error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const { nuclearFamilyId } = auth;
    const body = await request.json();
    const { request_id, action } = body;

    if (!request_id || !action) {
      return NextResponse.json({ error: 'request_id and action required' }, { status: 400 });
    }

    const client = await pool.connect();

    try {
      // Verify the request belongs to a halaqah owned by user's nuclear family
      const verifyRes = await client.query(
        `SELECT hm.halaqah_id FROM halaqah_members hm
         JOIN halaqahs h ON h.id = hm.halaqah_id
         WHERE hm.id = $1 AND h.nuclear_family_id = $2`,
        [request_id, nuclearFamilyId]
      );

      if (verifyRes.rows.length === 0) {
        return NextResponse.json({ error: 'Not authorized or request not found' }, { status: 404 });
      }

      // Update the request status
      await client.query(
        'UPDATE halaqah_members SET status = $1, updated_at = NOW() WHERE id = $2',
        [action === 'accept' ? 'active' : 'left', request_id]
      );

      return NextResponse.json({ message: `Request ${action}ed successfully` });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Update circle-family request error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}