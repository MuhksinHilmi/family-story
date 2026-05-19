import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { randomBytes } from 'crypto';
import { sendActivationLink } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, full_name, family_id, gender, phone } = body;

    if (!email || !family_id) {
      return NextResponse.json(
        { error: 'Email dan family_id diperlukan' },
        { status: 400 }
      );
    }

    const token = randomBytes(32).toString('hex');

    try {
      const result = await pool.query(
        `INSERT INTO family_nodes (family_id, full_name, gender, invitation_email, invitation_status, position_x, position_y, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'pending', 0, 0, NOW(), NOW())
         RETURNING id, family_id, full_name, gender, invitation_email, invitation_status`,
        [family_id, full_name || 'Anggota Keluarga', gender || 'male', email]
      );

      const newNode = result.rows[0];

      await pool.query(
        `INSERT INTO invitations (family_id, email, token, invited_by, expires_at, created_at)
         VALUES ($1, $2, $3, $4, NOW() + INTERVAL '7 days', NOW())`,
        [family_id, email, token, null]
      );

      await sendActivationLink(email, token);

      return NextResponse.json({
        message: 'Undangan berhasil dikirim',
        email,
        nodeId: newNode.id
      }, { status: 200 });
    } catch (error) {
      console.error('Database error:', error);
      throw error;
    }
  } catch (error) {
    console.error('Invite error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}