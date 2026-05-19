import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function DELETE(request: NextRequest) {
  try {
    const id = request.nextUrl.pathname.split('/').pop() || '';

    if (!id) {
      return NextResponse.json(
        { error: 'id diperlukan' },
        { status: 400 }
      );
    }

    const result = await pool.query(
      `SELECT invitation_status, user_id FROM family_nodes WHERE id = $1`,
      [parseInt(id, 10)]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Node tidak ditemukan' },
        { status: 404 }
      );
    }

    const node = result.rows[0];

    await pool.query(
      'DELETE FROM family_nodes WHERE id = $1',
      [parseInt(id, 10)]
    );

    return NextResponse.json({ message: 'Node dihapus' }, { status: 200 });
  } catch (error) {
    console.error('Delete node error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const id = request.nextUrl.pathname.split('/').pop() || '';

    if (!id) {
      return NextResponse.json(
        { error: 'id diperlukan' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { 
      full_name, 
      gender, 
      birth_date, 
      death_date,
      invitation_email,
      position_x,
      position_y,
      invitation_status 
    } = body;

    const updates: string[] = [];
    const values: unknown[] = [];
    let paramCount = 1;

    if (full_name !== undefined) {
      updates.push(`full_name = $${paramCount++}`);
      values.push(full_name);
    }
    if (gender !== undefined) {
      updates.push(`gender = $${paramCount++}`);
      values.push(gender);
    }
    if (birth_date !== undefined) {
      updates.push(`birth_date = $${paramCount++}`);
      values.push(birth_date);
    }
    if (death_date !== undefined) {
      updates.push(`death_date = $${paramCount++}`);
      updates.push(`is_alive = $${paramCount++}`);
      values.push(death_date, !death_date);
    }
    if (invitation_email !== undefined) {
      updates.push(`invitation_email = $${paramCount++}`);
      values.push(invitation_email);
    }
    if (position_x !== undefined) {
      updates.push(`position_x = $${paramCount++}`);
      values.push(Math.round(Number(position_x)));
    }
    if (position_y !== undefined) {
      updates.push(`position_y = $${paramCount++}`);
      values.push(Math.round(Number(position_y)));
    }
    if (invitation_status !== undefined) {
      updates.push(`invitation_status = $${paramCount++}`);
      values.push(invitation_status);
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: 'Tidak ada field yang diupdate' },
        { status: 400 }
      );
    }

    updates.push(`updated_at = NOW()`);
    values.push(parseInt(id));

    const result = await pool.query(
      `UPDATE family_nodes SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      [...values]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Node tidak ditemukan' },
        { status: 404 }
      );
    }

    const node = result.rows[0];
    return NextResponse.json({
      id: node.id,
      family_id: node.family_id,
      user_id: node.user_id,
      full_name: node.full_name,
      gender: node.gender,
      birth_date: node.birth_date,
      death_date: node.death_date,
      photo_url: node.photo_url,
      is_alive: node.is_alive,
      nasab_line: node.nasab_line,
      birth_order: node.birth_order,
      father_id: node.father_id,
      mother_id: node.mother_id,
      spouse_ids: [],
      children_ids: [],
      invitation_email: node.invitation_email,
      invitation_status: node.invitation_status,
      position_x: node.position_x,
      position_y: node.position_y,
      created_at: node.created_at,
      updated_at: node.updated_at
    }, { status: 200 });
  } catch (error) {
    console.error('Update node error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan' },
      { status: 500 }
    );
  }
}