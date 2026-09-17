import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db_helper';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email diperlukan' }, { status: 400 });
    }

    const result = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    return NextResponse.json({
      registered: result.rows.length > 0
    });
  } catch (error) {
    console.error('Check email error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan' }, { status: 500 });
  }
}
