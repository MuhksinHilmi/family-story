import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Token diperlukan' }, { status: 401 });
    }

    const userId = token.replace('token-', '').split('-')[0];
    const result = await pool.query(
      'SELECT id, full_name, email, phone, gender, birth_date FROM users WHERE id = $1',
      [userId]
    );
    return NextResponse.json({ user: result.rows[0] || null });
  } catch (error) {
    return NextResponse.json({ error: 'Terjadi kesalahan' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Token diperlukan' }, { status: 401 });
    }

    const body = await request.json();
    const { full_name, email, phone, gender, birth_date } = body;

    const userId = token.replace('token-', '').split('-')[0];
    const result = await pool.query(
      `UPDATE users SET full_name = COALESCE($1, full_name), email = COALESCE($2, email), 
                          phone = COALESCE($3, phone), gender = COALESCE($4, gender), 
                          birth_date = COALESCE($5, birth_date), updated_at = NOW()
       WHERE id = $6
       RETURNING id, full_name, email, phone, gender, birth_date`,
      [full_name, email, phone, gender, birth_date, userId]
    );

    await pool.query(
      `UPDATE family_nodes SET full_name = COALESCE($1, full_name), gender = COALESCE($2, gender), 
                            birth_date = COALESCE($3, birth_date)
       WHERE user_id = $4`,
      [full_name, gender, birth_date, userId]
    );

    return NextResponse.json({
      message: 'Profil berhasil diperbarui',
      user: result.rows[0],
    });
  } catch (error) {
    return NextResponse.json({ error: 'Terjadi kesalahan' }, { status: 500 });
  }
}