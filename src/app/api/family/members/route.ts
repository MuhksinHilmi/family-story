import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db_helper';
import { requireAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  // Protect this endpoint - requires valid JWT + fresh X-Timestamp
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const user_id = searchParams.get('user_id');
  const family_id = searchParams.get('family_id');

  try {
    if (user_id) {
      // Only allow user to query their own data (basic ownership check)
      // Compare as string to handle number vs string safely
      if (String(user_id) !== String(auth.userId)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }

      // Mode 1: Get families the user belongs to (used by Chat page)
      // Now also returns family_uuid + the general chat_room UUID for realtime
      const result = await pool.query(
        `SELECT 
           fm.id, 
           fm.family_id, 
           f.uuid as family_uuid,
           fm.role, 
           fm.joined_at, 
           f.name as family_name,
           cr.id as chat_room_id,
           cr.scope_type as chat_scope
         FROM family_members fm
         JOIN families f ON fm.family_id = f.id
         LEFT JOIN chat_rooms cr 
           ON cr.family_id = f.id AND cr.scope_type = 'general'
         WHERE fm.user_id = $1`,
        [user_id]
      );
      return NextResponse.json(result.rows, { status: 200 });
    }

    if (family_id) {
      // Mode 2: Get members of a family (used by Members page)
      // For now allow any authenticated user (later can restrict to family members only)
      const result = await pool.query(
        `SELECT 
           fm.id,
           fm.user_id,
           fm.role,
           fm.joined_at,
           u.full_name,
           u.email,
           u.phone,
           u.gender,
           u.birth_date
         FROM family_members fm
         LEFT JOIN users u ON fm.user_id = u.id
         WHERE fm.family_id = $1
         ORDER BY fm.joined_at ASC`,
        [family_id]
      );

      const members = result.rows.map((row: any) => ({
        id: row.user_id ?? row.id,
        full_name: row.full_name || 'Unknown',
        email: row.email || '',
        phone: row.phone || undefined,
        gender: row.gender || undefined,
        birth_date: row.birth_date || undefined,
        role: row.role,
      }));

      return NextResponse.json({ members }, { status: 200 });
    }

    return NextResponse.json({ error: 'user_id atau family_id diperlukan' }, { status: 400 });
  } catch (error) {
    console.error('Family members fetch error:', error);
    return NextResponse.json({ error: 'Gagal mengambil data keluarga' }, { status: 500 });
  }
}