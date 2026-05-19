import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json({ error: 'Token diperlukan' }, { status: 400 });
    }

    const invResult = await pool.query(
      `SELECT i.*, fn.id as node_id, fn.family_id, fn.full_name, fn.gender, fn.invitation_email
       FROM invitations i
       LEFT JOIN family_nodes fn ON fn.invitation_email = i.email AND fn.family_id = i.family_id
       WHERE i.token = $1 AND i.status = 'pending'`,
      [token]
    );

    if (invResult.rows.length > 0) {
      const invitation = invResult.rows[0];
      const nodeId = invitation.node_id;

      if (nodeId) {
        await pool.query(
          "UPDATE family_nodes SET invitation_status = 'accepted' WHERE id = $1",
          [nodeId]
        );
      }

      await pool.query(
        "UPDATE invitations SET status = 'accepted' WHERE id = $1",
        [invitation.id]
      );

      return NextResponse.json({ message: 'Undangan berhasil diterima', nodeId });
    }

    const userResult = await pool.query(
      'SELECT id, full_name, email, created_at FROM users WHERE activation_token = $1',
      [token]
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: 'Token tidak valid' }, { status: 404 });
    }

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
  } catch (error) {
    console.error('Activate error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan' }, { status: 500 });
  }
}