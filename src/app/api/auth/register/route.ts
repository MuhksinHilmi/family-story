import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { sendActivationLink } from '@/lib/email';
import { randomBytes } from 'crypto';

export async function POST(request: NextRequest) {
  const client = await pool.connect();
  try {
    const body = await request.json();
    const { full_name, email, phone, gender, birth_date, family_id } = body;

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
    const userResult = await client.query(
      `INSERT INTO users (full_name, email, phone, gender, birth_date, is_email_verified, is_phone_verified, activation_token, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, false, false, $6, NOW(), NOW())
       RETURNING id, full_name, email, phone, gender, birth_date`,
      [full_name, email, phone, gender, birth_date, activationToken]
    );

    const user = userResult.rows[0];

    let targetFamilyId: number;
    const isJoiningInvitation = !!family_id;

    if (family_id) {
      const familyCheck = await client.query(
        'SELECT id FROM families WHERE id = $1',
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
      await client.query(
        'UPDATE users SET is_email_verified = true WHERE id = $1',
        [user.id]
      );
    } else {
      const familyResult = await client.query(
        `INSERT INTO families (name, created_by, created_at, updated_at)
         VALUES ($1, $2, NOW(), NOW()) RETURNING id`,
        [`${full_name}'s Family`, user.id]
      );
      targetFamilyId = familyResult.rows[0].id;
    }

    await client.query(
      `INSERT INTO family_members (family_id, user_id, role, joined_at)
       VALUES ($1, $2, 'member', NOW())`,
      [targetFamilyId, user.id]
    );

    if (isJoiningInvitation) {
      await client.query(
        `UPDATE family_nodes 
         SET user_id = $1, invitation_status = 'accepted', updated_at = NOW()
         WHERE invitation_email = $2 AND family_id = $3`,
        [user.id, email, targetFamilyId]
      );
    } else {
      await client.query(
        `INSERT INTO family_nodes (family_id, user_id, full_name, gender, birth_date, position_x, position_y, invitation_status, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, 0, 0, 'accepted', NOW(), NOW())`,
        [targetFamilyId, user.id, full_name, gender, birth_date]
      );
    }

    await client.query('COMMIT');

    if (!isJoiningInvitation) {
      await sendActivationLink(email, activationToken);
    }

    return NextResponse.json(
      { message: isJoiningInvitation ? 'Akun terdaftar dan bergabung dengan keluarga.' : 'Akun terdaftar. Cek email untuk aktivasi.', user, family_id: targetFamilyId },
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