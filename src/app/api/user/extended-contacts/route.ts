import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import pool from '@/lib/db_helper';

/**
 * GET /api/user/extended-contacts
 * 
 * Mengembalikan daftar kontak dari extended family user yang login.
 * Digunakan untuk Custom visibility picker di feed.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const userId = auth.userId;

  try {
    const client = await pool.connect();

    try {
      // Ambil node_id user yang login
      const nodeRes = await client.query(
        'SELECT id FROM nodes WHERE user_id = $1 LIMIT 1',
        [userId]
      );

      if (nodeRes.rows.length === 0) {
        return NextResponse.json({ contacts: [] });
      }

      const myNodeId = nodeRes.rows[0].id;

      // Ambil semua node yang berbagi minimal 1 extended group dengan user
      const contactsRes = await client.query(
        `
          SELECT DISTINCT 
            n.id,
            n.full_name,
            n.photo_url,
            n.gender
          FROM nodes n
          JOIN node_extended_groups neg ON neg.node_id = n.id
          WHERE neg.extended_group_id IN (
            SELECT extended_group_id 
            FROM node_extended_groups 
            WHERE node_id = $1
          )
          AND n.id != $1
          ORDER BY n.full_name ASC
        `,
        [myNodeId]
      );

      return NextResponse.json({
        contacts: contactsRes.rows.map((row: any) => ({
          id: row.id,
          full_name: row.full_name,
          photo_url: row.photo_url,
          gender: row.gender,
        })),
      });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('GET /api/user/extended-contacts error:', error);
    return NextResponse.json(
      { error: 'Gagal mengambil daftar kontak extended family' },
      { status: 500 }
    );
  }
}