import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db_helper';
import { SignJWT } from 'jose';
import { sendOTP } from '@/lib/email';

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email diperlukan' }, { status: 400 });
    }

    const result = await pool.query(
      'SELECT id, full_name, gender, birth_date, is_email_verified FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Email tidak ditemukan. Silakan daftar terlebih dahulu.' }, { status: 404 });
    }

    const user = result.rows[0];

    if (!user.is_email_verified) {
      return NextResponse.json({ error: 'Email belum terverifikasi. Silakan verifikasi email terlebih dahulu.' }, { status: 403 });
    }
    const otp = generateOTP();

    await pool.query(
      'UPDATE users SET otp = $1, otp_expires_at = NOW() + INTERVAL \'5 minutes\' WHERE id = $2',
      [otp, user.id]
    );

    await sendOTP(email, otp);

    return NextResponse.json({ message: 'OTP telah dikirim ke email Anda' });
  } catch (error) {
    return NextResponse.json({ error: 'Terjadi kesalahan' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { email, otp } = await request.json();

const result = await pool.query(
       'SELECT id, uuid, full_name, email, phone, gender, birth_date, is_email_verified FROM users WHERE email = $1 AND otp = $2 AND otp_expires_at > NOW()',
       [email, otp]
     );

     if (result.rows.length === 0) {
       return NextResponse.json({ error: 'OTP tidak valid atau telah kadaluarsa' }, { status: 400 });
     }

     const user = result.rows[0];

     await pool.query(
       'UPDATE users SET otp = NULL, otp_expires_at = NULL WHERE id = $1',
       [user.id]
     );

     // Issue real JWT with UUID as sub for Supabase RLS compatibility
     const secret = new TextEncoder().encode(process.env.JWT_SECRET);
     const token = await new SignJWT({ 
       sub: user.uuid,  // UUID for auth.uid() compatibility with Supabase RLS
       email: user.email,
       full_name: user.full_name 
     })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(secret);

    return NextResponse.json({
      message: 'Berhasil masuk',
      token,
      user: {
        id: user.id,
        uuid: user.uuid,
        full_name: user.full_name,
        email: user.email,
        phone: user.phone,
        gender: user.gender,
        birth_date: user.birth_date,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Terjadi kesalahan' }, { status: 500 });
  }
}