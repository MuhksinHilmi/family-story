import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(request: NextRequest) {
  const client = await pool.connect();
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json({ error: 'Token diperlukan' }, { status: 400 });
    }

    // First check if this is an invitation token
    const invResult = await client.query(
      `SELECT i.id, i.family_id, i.email, i.token, i.status, i.expires_at, i.created_at,
              n.id as node_id, n.full_name, n.gender
       FROM invitations i
       LEFT JOIN family_nodes n ON n.invitation_email = i.email AND n.family_id = i.family_id
       WHERE i.token = $1`,
      [token]
    );

    if (invResult.rows.length > 0) {
      const invitation = invResult.rows[0];
      const isExpired = new Date(invitation.expires_at) < new Date();

      if (isExpired || invitation.status !== 'pending') {
        return NextResponse.json({ error: 'Undangan tidak valid atau sudah kadaluarsa' }, { status: 400 });
      }

      // Auto-create user from invitation if not exists
      const userResult = await client.query(
        'SELECT id, full_name, email FROM users WHERE email = $1',
        [invitation.email]
      );

      let userId: number;
      if (userResult.rows.length > 0) {
        userId = userResult.rows[0].id;
      } else {
        // Create new user with email from invitation
        const fullName = invitation.full_name || invitation.email.split('@')[0];
        const createUserRes = await client.query(
          `INSERT INTO users (full_name, email, gender, is_email_verified, is_phone_verified, created_at, updated_at)
           VALUES ($1, $2, $3, true, false, NOW(), NOW()) RETURNING id`,
          [fullName, invitation.email, invitation.gender || 'male']
        );
        userId = createUserRes.rows[0].id;
      }

      // Update family_nodes to link user
      await client.query(
        `UPDATE family_nodes 
         SET user_id = $1, invitation_status = 'accepted', updated_at = NOW()
         WHERE invitation_email = $2 AND family_id = $3`,
        [userId, invitation.email, invitation.family_id]
      );

      // Add to family_members if not already
      await client.query(
        `INSERT INTO family_members (family_id, user_id, role, joined_at)
         VALUES ($1, $2, 'member', NOW()) ON CONFLICT (family_id, user_id) DO NOTHING`,
        [invitation.family_id, userId]
      );

      // Mark invitation accepted
      await client.query(`UPDATE invitations SET status = 'accepted' WHERE token = $1`, [token]);

      return NextResponse.json({ 
        message: 'Undangan diterima', 
        token: `token-${userId}-${Date.now()}`,
        user: { id: userId, email: invitation.email }
      }, { status: 200 });
    }

    // Check if this is an activation token for regular user
    const userResult = await client.query(
      'SELECT id, full_name, email, created_at FROM users WHERE activation_token = $1',
      [token]
    );

    if (userResult.rows.length > 0) {
      const user = userResult.rows[0];
      const createdAt = new Date(user.created_at);
      const expiresAt = new Date(createdAt.getTime() + 24 * 60 * 60 * 1000);

      if (new Date() > expiresAt) {
        return NextResponse.json({ error: 'Token telah kadaluarsa' }, { status: 400 });
      }

      await client.query(
        'UPDATE users SET is_email_verified = true, activation_token = NULL WHERE id = $1',
        [user.id]
      );

      return NextResponse.json({ message: 'Akun berhasil diaktivasi' });
    }

    return NextResponse.json({ error: 'Token tidak valid' }, { status: 404 });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Activate error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan' }, { status: 500 });
  } finally {
    client.release();
  }
}

