import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db_helper';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'id diperlukan' }, { status: 400 });
  }

  try {
    const result = await pool.query(
      'SELECT id, name, description, created_by, created_at, updated_at FROM families WHERE id = $1',
      [parseInt(id, 10)]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Family tidak ditemukan' }, { status: 404 });
    }

    return NextResponse.json(result.rows[0], { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: 'Terjadi kesalahan' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { name, description } = body;

  if (!name) {
    return NextResponse.json({ error: 'name wajib diisi' }, { status: 400 });
  }

  try {
    const result = await pool.query(
      'UPDATE families SET name = $1, description = $2, updated_at = NOW() WHERE id = $3 RETURNING *',
      [name, description, body.id]
    );

    return NextResponse.json(result.rows[0], { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: 'Terjadi kesalahan' }, { status: 500 });
  }
}