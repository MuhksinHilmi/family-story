import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db_helper';

export async function GET(request: NextRequest) {
  const client = await pool.connect();
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');
    const familyId = searchParams.get('family_id');

    if (!userId) {
      return NextResponse.json(
        { error: 'user_id diperlukan' },
        { status: 400 }
      );
    }

    // Convert userId to integer
    const userIdInt = parseInt(userId, 10);
    if (isNaN(userIdInt)) {
      return NextResponse.json(
        { error: 'user_id tidak valid' },
        { status: 400 }
      );
    }
    
    // First, get user's family membership
    let userFamilyId = null;
    try {
      const memberResult = await client.query(
        `SELECT family_id FROM family_members WHERE user_id = $1 LIMIT 1`,
        [userIdInt]
      );
      if (memberResult.rows.length > 0) {
        userFamilyId = memberResult.rows[0].family_id;
      }
    } catch (e) {
      console.error('Family member query error:', e);
    }

    let query = `SELECT 
                   fn.id, fn.family_id, fn.user_id, fn.full_name, fn.gender, fn.birth_date, fn.death_date, 
                   COALESCE(u.photo_url, fn.photo_url) AS photo_url,
                   fn.is_alive, fn.nasab_line, fn.birth_order, fn.father_id, fn.mother_id,
                   fn.position_x, fn.position_y, fn.invitation_email, fn.invitation_status, 
                   fn.created_at, fn.updated_at
                 FROM family_nodes fn
                 LEFT JOIN users u ON fn.user_id = u.id
                 WHERE fn.user_id = $1`;
    
    const params: unknown[] = [userIdInt];

    if (familyId) {
      query += ` AND family_id = $2`;
      params.push(familyId);
    }

    const result = await client.query(query, params);

    if (result.rows.length === 0) {
      // Return default family_id 1 if user has no family yet (will be created on node creation)
      return NextResponse.json({ node: null, family_id: userFamilyId || '1' }, { status: 200 });
    }

    const node = result.rows[0];
    return NextResponse.json({
      node: {
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
        updated_at: node.updated_at,
      },
      family_id: userFamilyId
    }, { status: 200 });
  } catch (error) {
    console.error('Get node by user error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan', details: String(error) },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}