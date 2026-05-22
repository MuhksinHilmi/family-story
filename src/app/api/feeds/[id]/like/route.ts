import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import pool from '@/lib/db_helper';

/**
 * POST /api/feeds/[id]/like
 * Like a feed post.
 * User must be a member of the family that owns the feed.
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
    // Get feed and its family_uuid
    const feedRes = await pool.query(
      `SELECT family_uuid FROM family_feeds WHERE id = $1`,
      [feedId]
    );

    if (feedRes.rows.length === 0) {
      return NextResponse.json({ error: 'Feed tidak ditemukan' }, { status: 404 });
    }

    const familyUuid = feedRes.rows[0].family_uuid;

    // Validate membership (local schema uses family_id + join)
    const memberCheck = await pool.query(
      `SELECT 1 
       FROM family_members fm
       JOIN families f ON f.id = fm.family_id
       WHERE fm.user_id = $1 AND f.uuid = $2`,
      [userId, familyUuid]
    );

    if (memberCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Anda bukan anggota keluarga ini' }, { status: 403 });
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
    // Optional: still validate membership (or allow unlike even if left family?)
    const feedRes = await pool.query(
      `SELECT family_uuid FROM family_feeds WHERE id = $1`,
      [feedId]
    );

    if (feedRes.rows.length === 0) {
      return NextResponse.json({ error: 'Feed tidak ditemukan' }, { status: 404 });
    }

    const familyUuid = feedRes.rows[0].family_uuid;

    const memberCheck = await pool.query(
      `SELECT 1 
       FROM family_members fm
       JOIN families f ON f.id = fm.family_id
       WHERE fm.user_id = $1 AND f.uuid = $2`,
      [userId, familyUuid]
    );

    if (memberCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Anda bukan anggota keluarga ini' }, { status: 403 });
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
