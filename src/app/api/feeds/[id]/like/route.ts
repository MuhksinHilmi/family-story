import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import pool from '@/lib/db_helper';

/**
 * POST /api/feeds/[id]/like
 * Like a feed post.
 * Allowed only if the user can see the feed via feed_viewers snapshot.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const userId = auth.userId;
  const { id: feedId } = await params;

  try {
    // Get current user's node
    const nodeRes = await pool.query(
      'SELECT id FROM nodes WHERE user_id = $1 LIMIT 1',
      [userId]
    );

    if (nodeRes.rows.length === 0) {
      return NextResponse.json({ error: 'Anda belum memiliki node' }, { status: 403 });
    }

    const viewerNodeId = nodeRes.rows[0].id;

    // Check feed exists + user can see it via snapshot
    const accessCheck = await pool.query(
      `SELECT 1 
       FROM feeds f
       JOIN feed_viewers fv ON fv.feed_id = f.id
       WHERE f.id = $1 AND fv.viewer_node_id = $2`,
      [feedId, viewerNodeId]
    );

    if (accessCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Feed tidak ditemukan atau Anda tidak memiliki akses' }, { status: 404 });
    }

    // Insert like (ignore if already liked)
    await pool.query(
      `INSERT INTO feed_likes (feed_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (feed_id, user_id) DO NOTHING`,
      [feedId, userId]
    );

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('POST /api/feeds/[id]/like error:', error);
    return NextResponse.json({ error: 'Gagal like post' }, { status: 500 });
  }
}

/**
 * DELETE /api/feeds/[id]/like
 * Unlike a feed post.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const userId = auth.userId;
  const { id: feedId } = await params;

  try {
    // Get current user's node
    const nodeRes = await pool.query(
      'SELECT id FROM nodes WHERE user_id = $1 LIMIT 1',
      [userId]
    );

    if (nodeRes.rows.length === 0) {
      return NextResponse.json({ error: 'Anda belum memiliki node' }, { status: 403 });
    }

    const viewerNodeId = nodeRes.rows[0].id;

    // Check access via feed_viewers (allow unlike if they could see it)
    const accessCheck = await pool.query(
      `SELECT 1 
       FROM feeds f
       JOIN feed_viewers fv ON fv.feed_id = f.id
       WHERE f.id = $1 AND fv.viewer_node_id = $2`,
      [feedId, viewerNodeId]
    );

    if (accessCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Feed tidak ditemukan atau Anda tidak memiliki akses' }, { status: 404 });
    }

    // Remove like
    await pool.query(
      `DELETE FROM feed_likes WHERE feed_id = $1 AND user_id = $2`,
      [feedId, userId]
    );

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('DELETE /api/feeds/[id]/like error:', error);
    return NextResponse.json({ error: 'Gagal unlike post' }, { status: 500 });
  }
}
