import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db_helper';
import { sendActivationLink } from '@/lib/email';
import { randomBytes, randomUUID } from 'crypto';

export async function POST(request: NextRequest) {
  const client = await pool.connect();
  try {
    const body = await request.json();
    const { full_name, email, phone, gender, birth_date, family_id, family_uuid } = body;

    if (!full_name || !email) {
      return NextResponse.json(
        { error: 'Nama lengkap dan email wajib diisi' },
        { status: 400 }
      );
    }

    const existingResult = await client.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );
    if (existingResult.rows.length > 0) {
      return NextResponse.json(
        { error: 'Email sudah terdaftar' },
        { status: 409 }
      );
    }

    await client.query('BEGIN');

    const activationToken = randomBytes(32).toString('hex');
    const userUuid = randomUUID();

    const userResult = await client.query(
      `INSERT INTO users (uuid, full_name, email, phone, gender, birth_date, is_email_verified, is_phone_verified, activation_token, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, false, false, $7, NOW(), NOW())
       RETURNING id, uuid, full_name, email, phone, gender, birth_date`,
      [userUuid, full_name, email, phone, gender, birth_date, activationToken]
    );

    const user = userResult.rows[0];

    let targetFamilyId: number;
    let targetFamilyUuid: string;
    const isJoiningInvitation = !!(family_id || family_uuid);

    if (family_uuid) {
      // Preferred path: join via stable family_uuid (share link)
      const familyCheck = await client.query(
        'SELECT id, uuid FROM families WHERE uuid = $1',
        [family_uuid]
      );
      if (familyCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return NextResponse.json(
          { error: 'Family tidak ditemukan' },
          { status: 404 }
        );
      }
      targetFamilyId = familyCheck.rows[0].id;
      targetFamilyUuid = familyCheck.rows[0].uuid;
      // NOTE: Do NOT auto-verify email for share link.
      // User must still activate via email.
    } else if (family_id) {
      // Legacy path (still supported during transition)
      const familyCheck = await client.query(
        'SELECT id, uuid FROM families WHERE id = $1',
        [family_id]
      );
      if (familyCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return NextResponse.json(
          { error: 'Family tidak ditemukan' },
          { status: 404 }
        );
      }
      targetFamilyId = family_id;
      targetFamilyUuid = familyCheck.rows[0].uuid;
      // NOTE: Do NOT auto-verify email here either.
    } else {
      // New family registration
      const familyResult = await client.query(
        `INSERT INTO families (name, created_by, created_at, updated_at)
         VALUES ($1, $2, NOW(), NOW()) RETURNING id, uuid`,
        [`${full_name}'s Family`, user.id]
      );
      targetFamilyId = familyResult.rows[0].id;
      targetFamilyUuid = familyResult.rows[0].uuid;
    }

    await client.query(
      `INSERT INTO family_members (family_id, user_id, role, joined_at)
       VALUES ($1, $2, 'member', NOW())`,
      [targetFamilyId, user.id]
    );

    // Node creation logic (works for both normal registration and share link)
    // 1. Try to claim an existing pending invitation node (old "Tambah Anggota" flow)
    const claimResult = await client.query(
      `UPDATE family_nodes 
       SET user_id = $1, invitation_status = 'accepted', updated_at = NOW()
       WHERE invitation_email = $2 AND family_id = $3
       RETURNING id`,
      [user.id, email, targetFamilyId]
    );

    if (claimResult.rows.length === 0) {
      // No pending invitation found → create a fresh node.
      // This covers:
      // - Normal registration (new family)
      // - Share link registration (existing family via family_uuid)
      await client.query(
        `INSERT INTO family_nodes (family_id, user_id, full_name, gender, birth_date, position_x, position_y, invitation_status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, 0, 0, 'accepted', NOW(), NOW())`,
        [targetFamilyId, user.id, full_name, gender, birth_date]
      );
    }

    await client.query('COMMIT');

    // Always send activation email (user must activate before logging in)
    await sendActivationLink(email, activationToken);

    return NextResponse.json(
      {
        message: isJoiningInvitation
          ? 'Akun terdaftar dan berhasil bergabung dengan keluarga. Cek email untuk aktivasi.'
          : 'Akun terdaftar. Cek email untuk aktivasi.',
        user, // now includes uuid
        family_id: targetFamilyId,
        family_uuid: targetFamilyUuid,
      },
      { status: 201 }
    );
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}