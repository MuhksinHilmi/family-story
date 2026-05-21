import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db_helper';
import { randomBytes } from 'crypto';
import { sendInvitationLink } from '@/lib/email';

export async function POST(request: NextRequest) {
  const client = await pool.connect();
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

    // Get family_uuid for the stable external identifier (used for chat & future flows)
    const familyUuidResult = await client.query(
      'SELECT uuid FROM families WHERE id = $1',
      [family_id]
    );

    if (familyUuidResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Family tidak ditemukan' }, { status: 404 });
    }

    const familyUuid = familyUuidResult.rows[0].uuid;

    const nodeResult = await client.query(
      `INSERT INTO family_nodes (family_id, full_name, gender, invitation_email, invitation_status, position_x, position_y, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'pending', 0, 0, NOW(), NOW())
       RETURNING id, family_id, full_name, gender, invitation_email, invitation_status`,
      [family_id, full_name || 'Anggota Keluarga', gender || 'male', email]
    );

    await client.query(
      `INSERT INTO invitations (family_id, family_uuid, email, token, invited_by, expires_at, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '7 days', NOW())`,
      [family_id, familyUuid, email, token, null]
    );

    await sendInvitationLink(email, token);

    return NextResponse.json({
      message: 'Undangan berhasil dikirim',
      email,
      nodeId: nodeResult.rows[0].id
    }, { status: 200 });
  } catch (error) {
    console.error('Invite error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}