import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db_helper';
import { randomBytes } from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const pathParts = request.nextUrl.pathname.split('/');
    const nodeId = pathParts[pathParts.length - 2];
    const body = await request.json();
    const { email, family_id } = body;

    if (!nodeId || !email || !family_id) {
      return NextResponse.json(
        { error: 'nodeId, email, dan family_id wajib diisi' },
        { status: 400 }
      );
    }

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const result = await pool.query(
      `INSERT INTO invitations (family_id, email, token, invited_by, expires_at, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING id, family_id, email, token, status, expires_at, created_at`,
      [family_id, email, token, parseInt(nodeId), expiresAt.toISOString()]
    );

    await pool.query(
      `UPDATE family_nodes SET invitation_email = $1, invitation_status = 'pending' WHERE id = $2`,
      [email, parseInt(nodeId)]
    );

    return NextResponse.json({
      id: result.rows[0].id,
      family_id: result.rows[0].family_id,
      email: result.rows[0].email,
      token: result.rows[0].token,
      status: result.rows[0].status,
      expires_at: result.rows[0].expires_at,
      created_at: result.rows[0].created_at
    }, { status: 201 });
  } catch (error) {
    console.error('Invite error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan' },
      { status: 500 }
    );
  }
}