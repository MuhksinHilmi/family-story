import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import pool from '@/lib/db_helper';

// GET /api/feeds/:id
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const userId = auth.userId;
  const { id } = await params;

  try {
    // get viewer node id for the user
    const nodeRes = await pool.query('SELECT id FROM nodes WHERE user_id = $1 LIMIT 1', [userId]);
    if (nodeRes.rows.length === 0) {
      return NextResponse.json({ error: 'Anda belum memiliki node' }, { status: 403 });
    }
    const viewerNodeId = nodeRes.rows[0].id;

    const query = `
      SELECT 
        f.id,
        f.node_id,
        f.caption,
        f.scope_type,
        f.media,
        f.created_at,
        u.full_name as user_name,
        u.photo_url as user_photo,
        (SELECT COUNT(*) FROM feed_likes WHERE feed_id = f.id) as like_count,
        (SELECT COUNT(*) FROM feed_comments WHERE feed_id = f.id) as comment_count,
        EXISTS (
          SELECT 1 FROM feed_likes 
          WHERE feed_id = f.id AND user_id = (SELECT user_id FROM nodes WHERE id = $2)
        ) as has_liked,
        (
          SELECT COALESCE(json_agg(
            json_build_object(
              'id', n.id,
              'full_name', n.full_name,
              'photo_url', n.photo_url
            ) ORDER BY n.id
          ), '[]'::json)
          FROM (
            SELECT n.*
            FROM feed_viewers fv2
            JOIN nodes n ON n.id = fv2.viewer_node_id
            WHERE fv2.feed_id = f.id
              AND fv2.viewer_node_id != $2
            ORDER BY n.id
            LIMIT 9
          ) n
        ) as other_viewers,
        (
          SELECT COUNT(*) 
          FROM feed_viewers fv2 
          WHERE fv2.feed_id = f.id 
            AND fv2.viewer_node_id != $2
        ) as other_viewer_count
      FROM feeds f
      JOIN feed_viewers fv ON fv.feed_id = f.id
      JOIN nodes u ON u.id = f.node_id
      WHERE fv.viewer_node_id = $2
      AND f.id = $1
      LIMIT 1
    `;

    const res = await pool.query(query, [id, viewerNodeId]);
    if (res.rows.length === 0) {
      return NextResponse.json({ error: 'Feed tidak ditemukan atau Anda tidak memiliki akses' }, { status: 404 });
    }

    return NextResponse.json(res.rows[0]);
  } catch (error: any) {
    console.error('GET /api/feeds/[id] error:', error);
    return NextResponse.json({ error: 'Gagal mengambil feed' }, { status: 500 });
  }
}
