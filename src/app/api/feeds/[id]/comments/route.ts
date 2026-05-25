import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import pool from '@/lib/db_helper';

/**
 * GET /api/feeds/[id]/comments
 * Get all comments for a feed (new schema - visibility via feed_viewers).
 */
export async function GET(
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

    // Check that user can see this feed via snapshot
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

    // Get comments with user info
    const commentsRes = await pool.query(
      `SELECT 
         c.id,
         c.feed_id,
         c.user_id,
         c.comment,
         c.created_at,
         u.full_name as user_name,
         u.photo_url as user_photo
       FROM feed_comments c
       LEFT JOIN users u ON u.id = c.user_id
       WHERE c.feed_id = $1
       ORDER BY c.created_at ASC`,
      [feedId]
    );

    return NextResponse.json(commentsRes.rows, { status: 200 });
  } catch (error) {
    console.error('GET /api/feeds/[id]/comments error:', error);
    return NextResponse.json({ error: 'Gagal mengambil komentar' }, { status: 500 });
  }
}

/**
 * POST /api/feeds/[id]/comments
 * Add a new comment to a feed.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const userId = auth.userId;
  const { id: feedId } = await params;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { comment } = body;

  if (!comment || typeof comment !== 'string' || comment.trim().length === 0) {
    return NextResponse.json({ error: 'Komentar tidak boleh kosong' }, { status: 400 });
  }

  if (comment.length > 500) {
    return NextResponse.json({ error: 'Komentar maksimal 500 karakter' }, { status: 400 });
  }

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

    // Check access via feed_viewers snapshot
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

    // Insert comment
    const commentRes = await pool.query(
      `INSERT INTO feed_comments (feed_id, user_id, comment)
       VALUES ($1, $2, $3)
       RETURNING id, feed_id, user_id, comment, created_at`,
      [feedId, userId, comment.trim()]
    );

    const newComment = commentRes.rows[0];

    // Get user info for response
    const userRes = await pool.query(
      `SELECT full_name, photo_url FROM users WHERE id = $1`,
      [userId]
    );

    const user = userRes.rows[0];

    return NextResponse.json(
      {
        ...newComment,
        user_name: user?.full_name,
        user_photo: user?.photo_url,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('POST /api/feeds/[id]/comments error:', error);
    return NextResponse.json({ error: 'Gagal menambahkan komentar' }, { status: 500 });
  }
}
