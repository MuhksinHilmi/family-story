import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import pool from '@/lib/db_helper';

/**
 * GET /api/families/[family_uuid]/members
 * Returns all members of a family (for mention, etc.).
 * User must be a member of the family to access this.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ family_uuid: string }> }
) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const userId = auth.userId;
  const { family_uuid } = await params;

  try {
    // Check if user is member of this family (local schema: family_members uses family_id)
    const memberCheck = await pool.query(
      `SELECT 1 
       FROM family_members fm
       JOIN families f ON f.id = fm.family_id
       WHERE fm.user_id = $1 AND f.uuid = $2`,
      [userId, family_uuid]
    );

    if (memberCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Anda bukan anggota keluarga ini' }, { status: 403 });
    }

    // Get all family members (from family_nodes + users)
    const membersRes = await pool.query(
      `
      SELECT 
        fn.id as node_id,
        u.id as user_id,
        u.uuid,
        fn.full_name,
        u.photo_url,
        fn.gender
      FROM family_nodes fn
      LEFT JOIN users u ON u.id = fn.user_id
      JOIN families f ON f.id = fn.family_id
      WHERE f.uuid = $1
      ORDER BY fn.full_name ASC
      `,
      [family_uuid]
    );

    const members = membersRes.rows.map((row: any) => ({
      node_id: row.node_id,
      user_id: row.user_id,
      uuid: row.uuid,
      full_name: row.full_name,
      photo_url: row.photo_url,
      gender: row.gender,
    }));

    return NextResponse.json({
      family_uuid,
      members,
    }, { status: 200 });

  } catch (error) {
    console.error('GET /api/families/[family_uuid]/members error:', error);
    return NextResponse.json({ error: 'Gagal mengambil anggota keluarga' }, { status: 500 });
  }
}
