import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import pool from '@/lib/db_helper';

/**
 * POST /api/feeds
 * Create a new feed with proper visibility snapshot.
 * 
 * Body:
 * {
 *   caption?: string,
 *   media: Array<{ media_url: string, media_type: string, sort_order: number }>,
 *   scope_type: 'extended' | 'nuclear' | 'custom',
 *   custom_viewer_node_ids?: number[]   // required only if scope_type = 'custom'
 * }
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const userId = auth.userId;

  try {
    const body = await request.json();
    const { caption, media = [], scope_type, custom_viewer_node_ids = [] } = body;

    if (!['extended', 'nuclear', 'custom'].includes(scope_type)) {
      return NextResponse.json(
        { error: 'scope_type harus extended, nuclear, atau custom' },
        { status: 400 }
      );
    }

    if (!Array.isArray(media) || media.length === 0) {
      return NextResponse.json(
        { error: 'Minimal harus ada 1 media' },
        { status: 400 }
      );
    }

    const client = await pool.connect();

    try {
      // Get current user's node
      const nodeRes = await client.query(
        'SELECT id FROM nodes WHERE user_id = $1 LIMIT 1',
        [userId]
      );

      if (nodeRes.rows.length === 0) {
        return NextResponse.json(
          { error: 'Anda belum memiliki node di sistem' },
          { status: 403 }
        );
      }

      const posterNodeId = nodeRes.rows[0].id;

      // Insert feed
      const feedRes = await client.query(
        `INSERT INTO feeds (node_id, caption, scope_type, media, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())
         RETURNING id`,
        [posterNodeId, caption || null, scope_type, JSON.stringify(media)]
      );

      const feedId = feedRes.rows[0].id;

      // === SNAPSHOT LOGIC ===
      let viewerNodeIds: number[] = [];

      if (scope_type === 'nuclear') {
        // Copy current active nuclear viewers (father-centric snapshot)
        const viewersRes = await client.query(
          `SELECT viewer_node_id FROM node_active_nuclear_viewers WHERE node_id = $1`,
          [posterNodeId]
        );
        viewerNodeIds = viewersRes.rows.map((r: any) => r.viewer_node_id);

        // Also save to dedicated snapshot table for history
        if (viewerNodeIds.length > 0) {
          const values = viewerNodeIds
            .map((id) => `(${feedId}, ${id})`)
            .join(',');
          await client.query(
            `INSERT INTO feed_nuclear_viewers (feed_id, viewer_node_id) VALUES ${values}`
          );
        }
      } 
      else if (scope_type === 'custom') {
        if (!Array.isArray(custom_viewer_node_ids) || custom_viewer_node_ids.length === 0) {
          return NextResponse.json(
            { error: 'custom_viewer_node_ids wajib diisi untuk scope_type custom' },
            { status: 400 }
          );
        }

        // TODO: Validasi bahwa custom_viewer_node_ids ada di extended group poster
        // Untuk sekarang kita trust input (bisa diperketat nanti)
        viewerNodeIds = custom_viewer_node_ids;

        // Save to custom snapshot table
        const values = viewerNodeIds
          .map((id) => `(${feedId}, ${id})`)
          .join(',');
        await client.query(
          `INSERT INTO feed_custom_viewers (feed_id, viewer_node_id) VALUES ${values}`
        );
      } 
      else if (scope_type === 'extended') {
        // Snapshot semua node yang share minimal 1 extended group dengan poster
        const viewersRes = await client.query(
          `
            SELECT DISTINCT neg2.node_id as viewer_node_id
            FROM node_extended_groups neg1
            JOIN node_extended_groups neg2 
              ON neg1.extended_group_id = neg2.extended_group_id
            WHERE neg1.node_id = $1
          `,
          [posterNodeId]
        );
       viewerNodeIds = viewersRes.rows.map((r: any) => r.viewer_node_id);
       }
 
        // Always include the poster themselves
        if (!viewerNodeIds.includes(posterNodeId)) {
          viewerNodeIds.push(posterNodeId);
        }

        // Normalize viewerNodeIds to numbers and deduplicate (some sources may return strings)
        viewerNodeIds = Array.from(new Set(viewerNodeIds.map((id: any) => Number(id))));
  
        // Populate the main denormalized table for fast queries
        if (viewerNodeIds.length > 0) {
          const values = viewerNodeIds
            .map((id) => `(${feedId}, ${id})`)
            .join(',');
          await client.query(
            `INSERT INTO feed_viewers (feed_id, viewer_node_id) VALUES ${values} 
             ON CONFLICT DO NOTHING`
          );
        }

        // Create notifications for mentions parsed from caption (if any)
        // Mentions format: @<node_id> or @Full Name (we'll parse by @name)
        const mentionMatches = (caption || '').match(/@[\w\.\-]+/g) || [];
        console.log('DEBUG: mentionMatches=', mentionMatches);
        const mentionedNodeIds: number[] = [];

        for (const m of mentionMatches) {
          const raw = m.replace(/^@/, '').trim();
          if (!raw) continue;

          // If the matched span contains extra trailing words (eg. "Avida Saya test"),
          // try to resolve the longest prefix that matches a node full_name.
          const tokens = raw.split(/\s+/);
          let resolvedId: number | null = null;

          for (let len = tokens.length; len >= 1; len--) {
            const candidate = tokens.slice(0, len).join(' ');
            // exact match
            const nodeRes = await client.query(
              `SELECT id, user_id FROM nodes WHERE full_name = $1 LIMIT 1`,
              [candidate]
            );
            if (nodeRes.rows.length > 0) {
              resolvedId = nodeRes.rows[0].id;
              break;
            }

            // partial match
            const nodeRes2 = await client.query(
              `SELECT id, user_id FROM nodes WHERE full_name ILIKE $1 LIMIT 1`,
              [`%${candidate}%`]
            );
            if (nodeRes2.rows.length > 0) {
              resolvedId = nodeRes2.rows[0].id;
              break;
            }
          }

          if (resolvedId) {
            mentionedNodeIds.push(resolvedId);
          } else {
            console.log(`DEBUG: mention '${raw}' not resolved to any node`);
          }
        }

        console.log('DEBUG: mentionedNodeIds=', mentionedNodeIds);
        console.log('DEBUG: viewerNodeIds=', viewerNodeIds);

        // Insert notifications and optionally send emails for unique mentioned users
        const notifiedUserIds = new Set<number>();
        for (const nodeId of Array.from(new Set(mentionedNodeIds.map((n) => Number(n))))) {
          // get user_id for this node
          const nu = await client.query(`SELECT user_id FROM nodes WHERE id = $1 LIMIT 1`, [nodeId]);
          const mentionedUserId = nu.rows[0]?.user_id;
          if (!mentionedUserId) continue;

          // ensure mentioned user is in viewer list (visibility)
          if (!viewerNodeIds.includes(nodeId)) {
            console.log(`DEBUG: skipping mention for node ${nodeId} because not in viewerNodeIds`);
            continue;
          }

          // Insert notification
          const insertRes = await client.query(
            `INSERT INTO notifications (user_id, node_id, feed_id, type, actor_user_id, data)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (user_id, node_id, feed_id, type) DO NOTHING
             RETURNING id`,
            [mentionedUserId, nodeId, feedId, 'mention', auth.userId, JSON.stringify({ mention_text: caption })]
          );

          const insertedId = insertRes.rows[0]?.id;
          if (insertedId) {
            console.log('DEBUG: inserted notification id=', insertedId);
            notifiedUserIds.add(mentionedUserId);
          } else {
            console.log(`DEBUG: duplicate notification skipped for user ${mentionedUserId}, node ${nodeId}, feed ${feedId}`);
          }
        }


        // Send emails for mentioned users (queue + attempt immediate send for dev reliability)
        for (const uid of Array.from(notifiedUserIds)) {
          try {
            // fetch email
            const userRes = await pool.query(`SELECT email FROM users WHERE id = $1 LIMIT 1`, [uid]);
            const email = userRes.rows[0]?.email;
            if (!email) continue;

            const sendRes = await client.query(`SELECT id FROM notifications WHERE user_id = $1 AND feed_id = $2 AND type = 'mention' ORDER BY created_at DESC LIMIT 1`, [uid, feedId]);
            const notifId = sendRes.rows[0]?.id;

            // queue email to be processed asynchronously
            // @ts-ignore
            if (!(globalThis as any).emailQueue) (globalThis as any).emailQueue = [];
            // @ts-ignore
            (globalThis as any).emailQueue.push({ notifId, email, uid, feedId, actorUserId: auth.userId, caption });

            // Attempt immediate send asynchronously (helps in dev / when worker fails)
            (async () => {
              try {
                const { sendEmail } = await import('@/lib/email');
                const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
                const feedUrl = `${baseUrl}/feeds?focus=${feedId}`;
                const html = `\n                  <div style="font-family: Arial, sans-serif; max-width:520px; margin:0 auto;">\n                    <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">\n                      <img src="${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/images/logo-cerita-keluarga.png" alt="logo" width="48" height="48" />\n                      <div>\n                        <strong>Cerita Keluarga</strong>\n                        <div style="font-size:12px;color:#666;">Seseorang menyebut Anda dalam sebuah postingan</div>\n                      </div>\n                    </div>\n\n                    <p>Hai, seseorang menyebutkan Anda dalam postingan:</p>\n                    <blockquote style="background:#f8f8f8;padding:12px;border-radius:6px;color:#333;">${caption}</blockquote>\n\n                    <p>\n                      <a href="${feedUrl}" style="display:inline-block;background:#4A7C59;color:white;padding:10px 16px;text-decoration:none;border-radius:6px;">Lihat Postingan</a>\n                    </p>\n\n                    <p style="font-size:12px;color:#999;margin-top:12px;">Anda menerima notifikasi karena termasuk dalam jangkauan visibilitas postingan ini.</p>\n                  </div>\n                `;

                await sendEmail(email, 'Anda disebut dalam postingan - Cerita Keluarga', html);

                // mark notification email_sent true
                try {
                  await pool.query('UPDATE notifications SET email_sent = true WHERE id = $1', [notifId]);
                } catch (e) {
                  console.warn('Failed to mark notification email_sent', e);
                }
              } catch (e) {
                console.warn('Immediate mention email send failed', e);
              }
            })();

          } catch (e) {
            console.warn('Failed to queue mention email', e);
          }
        }

        // fire-and-forget start processing queued emails
        import('@/lib/notificationEmailWorker')
          .then((m) => m.processEmailQueue())
          .catch((err) => console.warn('Failed to start notification email worker', err));


      return NextResponse.json({
        message: 'Feed berhasil dibuat',
        feed_id: feedId,
        scope_type,
        viewers_count: viewerNodeIds.length,
      }, { status: 201 });

    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('POST /api/feeds error:', error);
    return NextResponse.json(
      { error: 'Gagal membuat feed', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/feeds
 * Returns feeds the current user is allowed to see based on visibility snapshots.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const userId = auth.userId;
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50);
  const before = searchParams.get('before');

  try {
    // Get current user's node
    const nodeRes = await pool.query(
      'SELECT id FROM nodes WHERE user_id = $1 LIMIT 1',
      [userId]
    );

    if (nodeRes.rows.length === 0) {
      return NextResponse.json({ feeds: [] });
    }

    const viewerNodeId = nodeRes.rows[0].id;

    const params: any[] = [viewerNodeId];
    let paramIndex = 2;

    let query = `
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
          WHERE feed_id = f.id AND user_id = (SELECT user_id FROM nodes WHERE id = $1)
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
              AND fv2.viewer_node_id != $1
            ORDER BY n.id
            LIMIT 9
          ) n
        ) as other_viewers,
        (
          SELECT COUNT(*) 
          FROM feed_viewers fv2 
          WHERE fv2.feed_id = f.id 
            AND fv2.viewer_node_id != $1
        ) as other_viewer_count
      FROM feeds f
      JOIN feed_viewers fv ON fv.feed_id = f.id
      JOIN nodes u ON u.id = f.node_id
      WHERE fv.viewer_node_id = $1
    `;

    if (before) {
      query += ` AND f.created_at < $${paramIndex}`;
      params.push(before);
      paramIndex++;
    }

    // Order feeds by latest activity: either creation time or latest comment time
    query += ` ORDER BY GREATEST(f.created_at, COALESCE((SELECT MAX(created_at) FROM feed_comments WHERE feed_id = f.id), f.created_at)) DESC LIMIT $${paramIndex}`;
    params.push(limit);

    const feedsRes = await pool.query(query, params);

    return NextResponse.json({
      feeds: feedsRes.rows,
    });
  } catch (error: any) {
    console.error('GET /api/feeds error:', error);
    return NextResponse.json(
      { error: 'Gagal mengambil feed' },
      { status: 500 }
    );
  }
}
