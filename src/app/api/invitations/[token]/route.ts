import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db_helper';

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.pathname.split('/').pop() || '';

    if (!token) {
      return NextResponse.json(
        { error: 'token diperlukan' },
        { status: 400 }
      );
    }

    const result = await pool.query(
      `SELECT i.id, i.family_id, i.email, i.token, i.status, i.expires_at, i.created_at,
              n.id as node_id, n.full_name, n.gender
       FROM invitations i
       LEFT JOIN family_nodes n ON n.invitation_email = i.email AND n.family_id = i.family_id
       WHERE i.token = $1`,
      [token]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Undangan tidak ditemukan' },
        { status: 404 }
      );
    }

    const invitation = result.rows[0];
    const isExpired = new Date(invitation.expires_at) < new Date();

    if (isExpired || invitation.status !== 'pending') {
      return NextResponse.json(
        { error: 'Undangan tidak valid atau sudah kadaluarsa' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      id: invitation.id,
      family_id: invitation.family_id,
      family_uuid: invitation.family_uuid, // ← Stable identifier for chat & future flows
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
    }, { status: 200 });
  } catch (error) {
    console.error('Get invitation error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.nextUrl.pathname.split('/').pop() || '';
    const body = await request.json();
    const { user_id, full_name, gender, birth_date } = body;

    if (!token || !user_id || !full_name || !gender) {
      return NextResponse.json(
        { error: 'token, user_id, full_name, dan gender wajib diisi' },
        { status: 400 }
      );
    }

    await pool.query('BEGIN');

    const inviteResult = await pool.query(
      `SELECT family_id, email FROM invitations WHERE token = $1 AND status = 'pending'`,
      [token]
    );

    if (inviteResult.rows.length === 0) {
      await pool.query('ROLLBACK');
      return NextResponse.json(
        { error: 'Undangan tidak valid' },
        { status: 400 }
      );
    }

    const { family_id, email } = inviteResult.rows[0];

    const nodeResult = await pool.query(
      `UPDATE family_nodes 
       SET user_id = $1, invitation_status = 'accepted', updated_at = NOW()
       WHERE invitation_email = $2 AND family_id = $3
       RETURNING id`,
      [user_id, email, family_id]
    );

    if (nodeResult.rows.length === 0) {
      await pool.query('ROLLBACK');
      return NextResponse.json(
        { error: 'Node tidak ditemukan' },
        { status: 404 }
      );
    }

    await pool.query(
      `INSERT INTO family_members (family_id, user_id, role, joined_at)
       VALUES ($1, $2, 'member', NOW())
       ON CONFLICT (family_id, user_id) DO NOTHING`,
      [family_id, user_id]
    );

    await pool.query(
      `UPDATE invitations SET status = 'accepted' WHERE token = $1`,
      [token]
    );

    await pool.query('COMMIT');

    return NextResponse.json({ message: 'Undangan diterima' }, { status: 200 });
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Accept invitation error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan' },
      { status: 500 }
    );
  }
}