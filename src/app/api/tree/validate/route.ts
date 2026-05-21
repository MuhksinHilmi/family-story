import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db_helper';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    const phone = searchParams.get('phone');

    const result = {
      emailExists: false,
      phoneExists: false,
    };

    if (email) {
      const emailCheck = await pool.query(
        `SELECT 1 FROM family_nodes WHERE invitation_email = $1 OR (SELECT email FROM users WHERE id = user_id) = $1`,
        [email]
      );
      result.emailExists = emailCheck.rows.length > 0;
    }

    if (phone) {
      const phoneCheck = await pool.query(
        `SELECT 1 FROM users WHERE phone = $1`,
        [phone]
      );
      result.phoneExists = phoneCheck.rows.length > 0;
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('Validate error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan' }, { status: 500 });
  }
}