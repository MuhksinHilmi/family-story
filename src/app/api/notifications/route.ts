import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import pool from '@/lib/db_helper';

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const userId = auth.userId;

  try {
    const res = await pool.query(
      `SELECT n.id, n.type, n.feed_id, n.actor_user_id, n.data, n.is_read, n.created_at,
              u.full_name as actor_name, u.photo_url as actor_photo,
              f.caption as feed_caption
       FROM notifications n
       LEFT JOIN users u ON u.id = n.actor_user_id
       LEFT JOIN feeds f ON f.id = n.feed_id
       WHERE n.user_id = $1
       ORDER BY n.created_at DESC
       LIMIT 50`,
      [userId]
    );

    return NextResponse.json({ notifications: res.rows });
  } catch (error: any) {
    console.error('GET /api/notifications error:', error);
    return NextResponse.json({ error: 'Gagal mengambil notifikasi' }, { status: 500 });
  }
}
