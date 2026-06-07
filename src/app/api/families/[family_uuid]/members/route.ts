import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import pool from '@/lib/db_helper';

/**
 * GET /api/families/[family_uuid]/members
 * Returns all members of a nuclear family (for mention, etc.).
 * User must be a member of the family to access this.
 * Uses new 2026 schema (nuclear_families + nuclear_family_memberships + nodes)
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
    // Check if user is member of this family
    const memberCheck = await pool.query(
      `SELECT 1 
       FROM nuclear_family_memberships nfm
       JOIN nuclear_families nf ON nf.id = nfm.nuclear_family_id
       JOIN nodes n ON n.id = nfm.node_id
       WHERE n.user_id = $1 AND nf.uuid = $2`,
      [userId, family_uuid]
    );

    if (memberCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Anda bukan anggota keluarga ini' }, { status: 403 });
    }

    // Get all family members (nodes with user link)
    const membersRes = await pool.query(
      `
      SELECT 
        n.id as node_id,
        u.id as user_id,
        u.uuid,
        n.full_name,
        u.photo_url,
        n.gender
      FROM nuclear_family_memberships nfm
      JOIN nodes n ON n.id = nfm.node_id
      LEFT JOIN users u ON u.id = n.user_id
      JOIN nuclear_families nf ON nf.id = nfm.nuclear_family_id
      WHERE nf.uuid = $1
      ORDER BY n.full_name ASC
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
