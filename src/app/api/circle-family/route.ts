import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db_helper';
import { requireAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    // Get halaqah groups where user's nuclear family is a member
    const groupsRes = await pool.query(
      `SELECT h.id, h.name, h.description, h.type, h.topics, h.chat_room_uuid,
              hm.is_admin,
              (SELECT COUNT(DISTINCT nuclear_family_id) FROM halaqah_members WHERE halaqah_id = h.id) as member_count
       FROM halaqahs h
       JOIN halaqah_members hm ON h.id = hm.halaqah_id
       JOIN nodes n ON hm.node_id = n.id
       JOIN nuclear_family_memberships nfm ON n.id = nfm.node_id
       JOIN nuclear_families nf ON nfm.nuclear_family_id = nf.id
       WHERE nf.id = $1 AND hm.status = 'active'
       ORDER BY h.updated_at DESC`,
      [auth.nuclearFamilyId]
    );

    const groups = groupsRes.rows.map((g: any) => ({
      id: g.id,
      name: g.name,
      description: g.description,
      type: g.type,
      topics: g.topics || [],
      chat_room_uuid: g.chat_room_uuid,
      is_admin: g.is_admin,
      member_count: parseInt(g.member_count) || 0,
    }));

    return NextResponse.json({ groups });
  } catch (error) {
    console.error('Get halaqah groups error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}