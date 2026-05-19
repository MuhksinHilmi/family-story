import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { sendActivationLink } from '@/lib/email';
import { randomBytes } from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { full_name, email, phone, gender, birth_date } = body;

    if (!full_name || !email || !phone) {
      return NextResponse.json(
        { error: 'Semua field wajib diisi' },
        { status: 400 }
      );
    }

    const existingResult = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );
    if (existingResult.rows.length > 0) {
      return NextResponse.json(
        { error: 'Email sudah terdaftar' },
        { status: 409 }
      );
    }

    const activationToken = randomBytes(32).toString('hex');
    const result = await pool.query(
      `INSERT INTO users (full_name, email, phone, gender, birth_date, is_email_verified, is_phone_verified, activation_token, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, false, false, $6, NOW(), NOW())
       RETURNING id, full_name, email, phone, gender, birth_date`,
      [full_name, email, phone, gender, birth_date, activationToken]
    );

    const user = result.rows[0];
    await sendActivationLink(email, activationToken);

    return NextResponse.json(
      { message: 'Akun terdaftar. Cek email untuk aktivasi.', user },
      { status: 201 }
    );
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan' },
      { status: 500 }
    );
  }
}