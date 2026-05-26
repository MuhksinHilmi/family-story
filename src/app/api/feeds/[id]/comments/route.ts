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

    // --- Mention handling: parse comment text and create notifications/emails ---
    try {
      const mentionMatches = (comment || '').match(/@[\w\.\-]+/g) || [];
      console.log('DEBUG(comment): mentionMatches=', mentionMatches);
      const mentionedNodeIds: number[] = [];

      for (const m of mentionMatches) {
        const raw = m.replace(/^@/, '').trim();
        if (!raw) continue;

        const tokens = raw.split(/\s+/);
        let resolvedId: number | null = null;

        for (let len = tokens.length; len >= 1; len--) {
          const candidate = tokens.slice(0, len).join(' ');
          const nodeRes = await pool.query(`SELECT id, user_id FROM nodes WHERE full_name = $1 LIMIT 1`, [candidate]);
          if (nodeRes.rows.length > 0) { resolvedId = nodeRes.rows[0].id; break; }
          const nodeRes2 = await pool.query(`SELECT id, user_id FROM nodes WHERE full_name ILIKE $1 LIMIT 1`, [`%${candidate}%`]);
          if (nodeRes2.rows.length > 0) { resolvedId = nodeRes2.rows[0].id; break; }
        }

        if (resolvedId) mentionedNodeIds.push(resolvedId);
        else console.log(`DEBUG(comment): mention '${raw}' not resolved`);
      }

      console.log('DEBUG(comment): mentionedNodeIds=', mentionedNodeIds);

      // get feed viewers snapshot
      const viewersRes = await pool.query(`SELECT viewer_node_id FROM feed_viewers WHERE feed_id = $1`, [feedId]);
      let viewerNodeIds = viewersRes.rows.map((r: any) => r.viewer_node_id);
      // normalize to numbers
      viewerNodeIds = Array.from(new Set(viewerNodeIds.map((v: any) => Number(v))));

      const notifiedUserIds = new Set<number>();

      for (const nodeId of Array.from(new Set(mentionedNodeIds.map((n) => Number(n))))) {
        const nu = await pool.query(`SELECT user_id FROM nodes WHERE id = $1 LIMIT 1`, [nodeId]);
        const mentionedUserId = nu.rows[0]?.user_id;
        if (!mentionedUserId) continue;
        if (!viewerNodeIds.includes(nodeId)) {
          console.log(`DEBUG(comment): skipping mention for node ${nodeId} not in viewers`);
          continue;
        }

        // insert notification (prevent duplicates)
        const insertRes = await pool.query(
          `INSERT INTO notifications (user_id, node_id, feed_id, type, actor_user_id, data)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (user_id, node_id, feed_id, type) DO NOTHING
           RETURNING id`,
          [mentionedUserId, nodeId, feedId, 'mention', userId, JSON.stringify({ mention_text: comment })]
        );

        const insertedId = insertRes.rows[0]?.id;
        if (insertedId) {
          console.log('DEBUG(comment): inserted notification id=', insertedId);
          notifiedUserIds.add(mentionedUserId);
        }
      }

      // queue/send emails for notified users
      for (const uid of Array.from(notifiedUserIds)) {
        try {
          const userRes = await pool.query(`SELECT email FROM users WHERE id = $1 LIMIT 1`, [uid]);
          const email = userRes.rows[0]?.email;
          if (!email) continue;

          const sendRes = await pool.query(`SELECT id FROM notifications WHERE user_id = $1 AND feed_id = $2 AND type = 'mention' ORDER BY created_at DESC LIMIT 1`, [uid, feedId]);
          const notifId = sendRes.rows[0]?.id;

          if (!(globalThis as any).emailQueue) (globalThis as any).emailQueue = [];
          (globalThis as any).emailQueue.push({ notifId, email, uid, feedId, actorUserId: userId, comment });

          (async () => {
            try {
              const { sendEmail } = await import('@/lib/email');
              const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
              const feedUrl = `${baseUrl}/feeds?focus=${feedId}`;
              const html = `\n                <div style="font-family: Arial, sans-serif; max-width:520px; margin:0 auto;">\n                  <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">\n                    <img src="${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/images/logo-cerita-keluarga.png" alt="logo" width="48" height="48" />\n                    <div>\n                      <strong>Cerita Keluarga</strong>\n                      <div style="font-size:12px;color:#666;">Seseorang menyebut Anda dalam komentar</div>\n                    </div>\n                  </div>\n
                  <p>Hai, seseorang menyebutkan Anda dalam komentar pada postingan:</p>\n                  <blockquote style="background:#f8f8f8;padding:12px;border-radius:6px;color:#333;">${comment}</blockquote>\n
                  <p>\n                    <a href="${feedUrl}" style="display:inline-block;background:#4A7C59;color:white;padding:10px 16px;text-decoration:none;border-radius:6px;">Lihat Postingan</a>\n                  </p>\n
                  <p style="font-size:12px;color:#999;margin-top:12px;">Anda menerima notifikasi karena termasuk dalam jangkauan visibilitas postingan ini.</p>\n                </div>\n              `;

              await sendEmail(email, 'Anda disebut dalam komentar - Cerita Keluarga', html);

              try {
                await pool.query('UPDATE notifications SET email_sent = true WHERE id = $1', [notifId]);
              } catch (e) {
                console.warn('Failed to mark notification email_sent', e);
              }
            } catch (e) {
              console.warn('Immediate comment mention email send failed', e);
            }
          })();
        } catch (e) {
          console.warn('Failed to queue comment mention email', e);
        }
      }
    } catch (e) {
      console.warn('Error processing comment mentions', e);
    }

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
