import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const familyId = searchParams.get('family_id');

    if (!familyId) {
      return NextResponse.json(
        { error: 'family_id diperlukan' },
        { status: 400 }
      );
    }

    const result = await pool.query(
      `SELECT u.id, u.full_name, u.email, u.phone, u.gender, u.birth_date, fm.role, fm.joined_at
       FROM family_members fm
       JOIN users u ON u.id = fm.user_id
       WHERE fm.family_id = $1
       ORDER BY fm.joined_at DESC`,
      [parseInt(familyId, 10)]
    );

    return NextResponse.json({ members: result.rows }, { status: 200 });
  } catch (error) {
    console.error('Get family members error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan' },
      { status: 500 }
    );
  }
}