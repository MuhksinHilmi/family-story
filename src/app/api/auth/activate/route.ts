import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json({ error: 'Token diperlukan' }, { status: 400 });
    }

    const userResult = await pool.query(
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

      await pool.query(
        'UPDATE users SET is_email_verified = true, activation_token = NULL WHERE id = $1',
        [user.id]
      );

      return NextResponse.json({ message: 'Akun berhasil diaktivasi' });
    }

    const invResult = await pool.query(
      `SELECT i.id, i.family_id, i.email, i.token, i.status, i.expires_at, i.created_at,
              n.id as node_id, n.full_name, n.gender
       FROM invitations i
       LEFT JOIN family_nodes n ON n.invitation_email = i.email AND n.family_id = i.family_id
       WHERE i.token = $1`,
      [token]
    );

    if (invResult.rows.length === 0) {
      return NextResponse.json({ error: 'Token tidak valid' }, { status: 404 });
    }

    const invitation = invResult.rows[0];
    const isExpired = new Date(invitation.expires_at) < new Date();

    if (isExpired || invitation.status !== 'pending') {
      return NextResponse.json({ error: 'Undangan tidak valid atau sudah kadaluarsa' }, { status: 400 });
    }

    return NextResponse.json({
      message: 'Undangan ditemukan',
      invitation: {
        id: invitation.id,
        family_id: invitation.family_id,
        email: invitation.email,
        token: invitation.token,
        status: invitation.status,
        expires_at: invitation.expires_at,
        created_at: invitation.created_at,
        node: invitation.node_id ? {
          id: invitation.node_id,
          full_name: invitation.full_name,
          gender: invitation.gender
        } : null
      }
    }, { status: 200 });
  } catch (error) {
    console.error('Activate error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan' }, { status: 500 });
  }
}
