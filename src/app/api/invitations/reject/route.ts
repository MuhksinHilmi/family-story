import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db_helper';
import { requireAuth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);

  if ('error' in auth) {
    return auth.error;
  }

  const { userId } = auth;

  const body = await request.json();
  const { token } = body;

  if (!token) {
    return NextResponse.json({ error: 'Token undangan diperlukan' }, { status: 400 });
  }

  const client = await pool.connect();

  try {
    // Ambil data user
    const userRes = await client.query('SELECT email FROM users WHERE id = $1', [userId]);
    const userEmail = userRes.rows[0]?.email;

    // Ambil node milik user
    const nodesRes = await client.query('SELECT id FROM nodes WHERE user_id = $1', [userId]);
    const userNodeIds = nodesRes.rows.map((r: any) => r.id);

    // Cari undangan berdasarkan token
    const invitationRes = await client.query(
      `SELECT id, status, invitee_node_id, invitee_email 
       FROM invitations 
       WHERE token = $1`,
      [token]
    );

    if (invitationRes.rows.length === 0) {
      return NextResponse.json({ error: 'Undangan tidak ditemukan' }, { status: 404 });
    }

    const invitation = invitationRes.rows[0];

    if (invitation.status !== 'pending') {
      return NextResponse.json({ error: 'Undangan sudah tidak aktif' }, { status: 400 });
    }

    // Validasi bahwa undangan ini memang ditujukan ke user yang login
    const isOwner =
      (invitation.invitee_node_id && userNodeIds.includes(invitation.invitee_node_id)) ||
      (invitation.invitee_email && invitation.invitee_email === userEmail);

    if (!isOwner) {
      return NextResponse.json(
        { error: 'Anda tidak memiliki hak untuk menolak undangan ini' },
        { status: 403 }
      );
    }

    // Update status menjadi revoked
    await client.query(
      `UPDATE invitations 
       SET status = 'revoked', used_at = NOW(), updated_at = NOW() 
       WHERE id = $1`,
      [invitation.id]
    );

    return NextResponse.json({ message: 'Undangan berhasil ditolak' });
  } catch (error) {
    console.error('Reject invitation error:', error);
    return NextResponse.json(
      { error: 'Gagal menolak undangan' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
