import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import pool from '@/lib/db_helper';

/**
 * GET /api/small-families/[uuid]/members
 * Returns members of a specific Keluarga Inti (nuclear family).
 *
 * The [uuid] is the small_family_uuid (husband's users.uuid).
 *
 * Access: User must be a member of the same family and have access to this small family
 * (i.e., be the husband, wife, or child of this nuclear family).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const userId = auth.userId;
  const { uuid: smallFamilyUuid } = await params; // this is the husband's users.uuid

  try {
    // 1. Find the small family room to get the family_uuid
    const roomRes = await pool.query(
      `SELECT family_uuid, small_family_uuid 
       FROM chat_rooms 
       WHERE small_family_uuid = $1 AND scope_type = 'small'`,
      [smallFamilyUuid]
    );

    if (roomRes.rows.length === 0) {
      return NextResponse.json({ error: 'Keluarga inti tidak ditemukan' }, { status: 404 });
    }

    const { family_uuid } = roomRes.rows[0];

    // 2. Validate that the current user is a member of this family
    const memberCheck = await pool.query(
      `SELECT 1 
       FROM family_members fm
       JOIN families f ON f.id = fm.family_id
       WHERE fm.user_id = $1 AND f.uuid = $2`,
      [userId, family_uuid]
    );

    if (memberCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Anda tidak memiliki akses ke keluarga ini' }, { status: 403 });
    }

    // 3. Get the husband node (the owner of this small family)
    const husbandRes = await pool.query(
      `SELECT fn.id as node_id, fn.full_name, fn.gender, u.id as user_id, u.uuid, u.photo_url
        FROM family_nodes fn
        JOIN users u ON u.id = fn.user_id
        JOIN families f ON f.id = fn.family_id
        WHERE u.uuid = $1 AND f.uuid = $2`,
      [smallFamilyUuid, family_uuid]
    );

    if (husbandRes.rows.length === 0) {
      return NextResponse.json({ error: 'Suami tidak ditemukan' }, { status: 404 });
    }

    const husband = husbandRes.rows[0];

    // 4. Get the wife (spouse of the husband)
    const wifeRes = await pool.query(
      `SELECT fn.id as node_id, fn.full_name, fn.gender, u.id as user_id, u.uuid, u.photo_url
       FROM spouse_relations sr
       JOIN family_nodes fn ON fn.id = (CASE WHEN sr.node_a = $1 THEN sr.node_b ELSE sr.node_a END)
       LEFT JOIN users u ON u.id = fn.user_id
       JOIN families f ON f.id = fn.family_id
       WHERE (sr.node_a = $1 OR sr.node_b = $1)
         AND fn.gender = 'female'
         AND f.uuid = $2`,
      [husband.node_id, family_uuid]
    );

    // 5. Get children of this couple (using father_id / mother_id, not parent_id)
    const childrenRes = await pool.query(
      `SELECT fn.id as node_id, fn.full_name, fn.gender, u.id as user_id, u.uuid, u.photo_url
       FROM family_nodes fn
       LEFT JOIN users u ON u.id = fn.user_id
       JOIN families f ON f.id = fn.family_id
       WHERE (fn.father_id = $1 OR fn.mother_id = $1)
         AND f.uuid = $2
       ORDER BY fn.birth_date ASC NULLS LAST, fn.full_name`,
       [husband.node_id, family_uuid]
     );

    const members = [];

    // Add husband
    members.push({
      node_id: husband.node_id,
      user_id: husband.user_id,
      uuid: husband.uuid,
      full_name: husband.full_name,
      photo_url: husband.photo_url,
      gender: husband.gender,
      relationship: 'suami',
    });

    // Add wife if exists
    if (wifeRes.rows.length > 0) {
      const wife = wifeRes.rows[0];
      members.push({
        node_id: wife.node_id,
        user_id: wife.user_id,
        uuid: wife.uuid,
        full_name: wife.full_name,
        photo_url: wife.photo_url,
        gender: wife.gender,
        relationship: 'istri',
      });
    }

    // Add children
    childrenRes.rows.forEach((child: any) => {
      members.push({
        node_id: child.node_id,
        user_id: child.user_id,
        uuid: child.uuid,
        full_name: child.full_name,
        photo_url: child.photo_url,
        gender: child.gender,
        relationship: 'anak',
      });
    });

    return NextResponse.json({
      small_family_uuid: smallFamilyUuid,
      family_uuid,
      members,
    }, { status: 200 });

  } catch (error) {
    console.error('GET /api/small-families/[uuid]/members error:', error);
    return NextResponse.json({ error: 'Gagal mengambil anggota keluarga inti' }, { status: 500 });
  }
}
