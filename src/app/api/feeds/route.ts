import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import pool from '@/lib/db_helper';

/**
 * GET /api/feeds?family_uuid=xxx&limit=20&before=...
 * Returns list of family feeds with media, like count, comment count, and has_liked status.
 * Only returns feeds from families the user is a member of.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const familyUuid = searchParams.get('family_uuid');
  const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50);
  const before = searchParams.get('before');

  if (!familyUuid) {
    return NextResponse.json({ error: 'family_uuid diperlukan' }, { status: 400 });
  }

  const userId = auth.userId;

  try {
    // Validate that user is member of this family (local schema uses family_id + join to families.uuid)
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

    // Build query for feeds
    const params: any[] = [familyUuid, userId];
    let paramIndex = 3;

    let query = `
      SELECT 
        f.id,
        f.family_uuid,
        f.user_id,
        f.caption,
        f.created_at,
        u.full_name as user_name,
        u.photo_url as user_photo,
        COALESCE(like_count.cnt, 0) as like_count,
        COALESCE(comment_count.cnt, 0) as comment_count,
        EXISTS (
          SELECT 1 FROM feed_likes fl 
          WHERE fl.feed_id = f.id AND fl.user_id = $2
        ) as has_liked
      FROM family_feeds f
      LEFT JOIN users u ON u.id = f.user_id
      LEFT JOIN (
        SELECT feed_id, COUNT(*) as cnt 
        FROM feed_likes 
        GROUP BY feed_id
      ) like_count ON like_count.feed_id = f.id
      LEFT JOIN (
        SELECT feed_id, COUNT(*) as cnt 
        FROM feed_comments 
        GROUP BY feed_id
      ) comment_count ON comment_count.feed_id = f.id
      WHERE f.family_uuid = $1
        AND (
          f.scope_type = 'general'
          OR f.recipient_user_ids @> ('["' || $2 || '"]')::jsonb
          OR EXISTS (
            SELECT 1 FROM chat_rooms cr
            WHERE cr.family_uuid = f.family_uuid
              AND cr.scope_type = 'small'
              AND cr.small_family_uuid = f.small_family_uuid
          )
        )
    `;

    if (before) {
      query += ` AND f.created_at < $${paramIndex}`;
      params.push(before);
      paramIndex++;
    }

    query += ` ORDER BY f.created_at DESC LIMIT $${paramIndex}`;
    params.push(limit);

    const feedsRes = await pool.query(query, params);
    const feeds = feedsRes.rows;

    // Fetch media for all feeds in one query (more efficient)
    const feedIds = feeds.map((f: any) => f.id);

    let media: any[] = [];
    if (feedIds.length > 0) {
      const mediaRes = await pool.query(
        `SELECT * FROM feed_media 
         WHERE feed_id = ANY($1::uuid[]) 
         ORDER BY feed_id, sort_order`,
        [feedIds]
      );
      media = mediaRes.rows;
    }

    // Group media by feed_id
    const mediaMap = new Map<string, any[]>();
    media.forEach((m) => {
      if (!mediaMap.has(m.feed_id)) mediaMap.set(m.feed_id, []);
      mediaMap.get(m.feed_id)!.push(m);
    });

    // Attach media to each feed
    const result = feeds.map((feed: any) => ({
      ...feed,
      like_count: Number(feed.like_count) || 0,
      comment_count: Number(feed.comment_count) || 0,
      media: mediaMap.get(feed.id) || [],
    }));

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('GET /api/feeds error:', error);
    return NextResponse.json({ error: 'Gagal mengambil feeds' }, { status: 500 });
  }
}

/**
 * POST /api/feeds
 * Body: {
 *   family_uuid: string,
 *   caption?: string,
 *   media: Array<...>,
 *   scope_type: 'general' | 'small',           // default 'general'
 *   small_family_uuid?: string,                // required if scope_type = 'small'
 *   recipient_user_ids?: string[] | null       // null = all members of the small family
 * }
 * 
 * Max 6 media items per post
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const userId = auth.userId;
  let body: any;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { 
    family_uuid, 
    caption, 
    media = [], 
    scope_type = 'general', 
    small_family_uuid = null,
    recipient_user_ids = null 
  } = body;

  if (!family_uuid) {
    return NextResponse.json({ error: 'family_uuid wajib diisi' }, { status: 400 });
  }

  if (!['general', 'small'].includes(scope_type)) {
    return NextResponse.json({ error: 'scope_type tidak valid' }, { status: 400 });
  }

  if (scope_type === 'small' && !small_family_uuid) {
    return NextResponse.json({ error: 'small_family_uuid wajib diisi untuk Keluarga Inti' }, { status: 400 });
  }

  if (!Array.isArray(media) || media.length > 6) {
    return NextResponse.json({ error: 'Maksimal 6 media per post' }, { status: 400 });
  }

  try {
    // Validate family membership (local schema uses family_id + join to families.uuid)
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

    // Start transaction
    await pool.query('BEGIN');

    // 1. Insert feed with visibility fields
    const feedRes = await pool.query(
      `INSERT INTO family_feeds (family_uuid, user_id, caption, scope_type, small_family_uuid, recipient_user_ids)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, family_uuid, user_id, caption, scope_type, small_family_uuid, recipient_user_ids, created_at`,
      [family_uuid, userId, caption || null, scope_type, small_family_uuid, recipient_user_ids]
    );

    const feed = feedRes.rows[0];
    const feedId = feed.id;

    // 2. Insert media (if any)
    const insertedMedia: any[] = [];

    for (let i = 0; i < media.length; i++) {
      const m = media[i];
      const sortOrder = m.sort_order ?? i;

      const mediaRes = await pool.query(
        `INSERT INTO feed_media (feed_id, media_url, media_type, sort_order)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [feedId, m.media_url, m.media_type || 'image', sortOrder]
      );

      insertedMedia.push(mediaRes.rows[0]);
    }

    await pool.query('COMMIT');

    // Return created feed with media
    return NextResponse.json(
      {
        ...feed,
        media: insertedMedia,
      },
      { status: 201 }
    );
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('POST /api/feeds error:', error);
    return NextResponse.json({ error: 'Gagal membuat feed' }, { status: 500 });
  }
}
