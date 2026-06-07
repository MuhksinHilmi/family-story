import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db_helper';
import { requireAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);

  if ('error' in auth) {
    return auth.error;
  }

  const { userId } = auth;
  const client = await pool.connect();

  try {
    const nodeRes = await client.query(
      'SELECT id FROM nodes WHERE user_id = $1',
      [userId]
    );

    if (nodeRes.rows.length === 0) {
      return NextResponse.json({ break_requests: [] });
    }

    const userNodeId = nodeRes.rows[0].id;

    const requestsRes = await client.query(
      `SELECT 
         br.id,
         br.reason,
         br.created_at,
         n.full_name as requester_name,
         n.gender as requester_gender
       FROM break_requests br
       JOIN nodes n ON n.id = br.requester_node_id
       WHERE br.spouse_node_id = $1 AND br.status = 'pending'
       ORDER BY br.created_at DESC`,
      [userNodeId]
    );

    return NextResponse.json({
      break_requests: requestsRes.rows.map((row: any) => ({
        id: row.id,
        reason: row.reason,
        created_at: row.created_at,
        requester: {
          full_name: row.requester_name,
          gender: row.requester_gender,
        },
      })),
    });
  } catch (error) {
    console.error('Get break requests error:', error);
    return NextResponse.json(
      { error: 'Gagal mengambil permintaan putus hubungan' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);

  if ('error' in auth) {
    return auth.error;
  }

  const { userId } = auth;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body tidak valid' }, { status: 400 });
  }

  const { node_id, spouse_id, reason } = body;

  if (!node_id || !spouse_id || !reason) {
    return NextResponse.json({ error: 'node_id, spouse_id, dan reason diperlukan' }, { status: 400 });
  }

  if (!['divorce', 'wrong_data'].includes(reason)) {
    return NextResponse.json({ error: 'Reason harus divorce atau wrong_data' }, { status: 400 });
  }

  const client = await pool.connect();

  try {
    const nodeRes = await client.query(
      `SELECT id, user_id FROM nodes WHERE id = $1`,
      [parseInt(node_id, 10)]
    );

    if (nodeRes.rows.length === 0) {
      return NextResponse.json({ error: 'Node tidak ditemukan' }, { status: 404 });
    }

    const node = nodeRes.rows[0];
    if (node.user_id !== userId) {
      return NextResponse.json({ error: 'Hanya bisa mengirim permintaan untuk node milik sendiri' }, { status: 403 });
    }

    const marriageRes = await client.query(
      `SELECT id FROM marriages 
       WHERE (husband_node_id = $1 AND wife_node_id = $2 OR husband_node_id = $2 AND wife_node_id = $1)
         AND status = 'married'`,
      [parseInt(node_id, 10), parseInt(spouse_id, 10)]
    );

    if (marriageRes.rows.length === 0) {
      return NextResponse.json({ error: 'Tidak ada pernikahan aktif antara node ini' }, { status: 400 });
    }

    const marriageId = marriageRes.rows[0].id;

    const existingReq = await client.query(
      `SELECT id FROM break_requests 
       WHERE marriage_id = $1 AND status = 'pending'`,
      [marriageId]
    );

    if (existingReq.rows.length > 0) {
      return NextResponse.json({ error: 'Permintaan putus hubungan sudah ada dan sedang menunggu konfirmasi' }, { status: 400 });
    }

const result = await client.query(
      `INSERT INTO break_requests (requester_node_id, spouse_node_id, marriage_id, reason)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [parseInt(node_id, 10), parseInt(spouse_id, 10), marriageId, reason]
    );

    // Notify the spouse (create in-app notification)
    const spouseNodeId = parseInt(spouse_id, 10);
    const requesterNodeId = parseInt(node_id, 10);
    const requesterNameRes = await client.query(
      `SELECT full_name FROM nodes WHERE id = $1`,
      [requesterNodeId]
    );
    const requesterName = requesterNameRes.rows[0]?.full_name || 'Seseorang';

    // Get spouse's user_id for notification
    const spouseUserRes = await client.query(
      `SELECT user_id FROM nodes WHERE id = $1`,
      [spouseNodeId]
    );
    const spouseUserId = spouseUserRes.rows[0]?.user_id;

    if (spouseUserId) {
      await client.query(
        `INSERT INTO notifications (user_id, node_id, type, actor_user_id, data)
         VALUES ($1, $2, 'break_request', $3, jsonb_build_object(
           'marriage_id', $4,
           'reason', $5,
           'requester_name', $6
         ))`,
        [spouseUserId, requesterNodeId, requesterNodeId, marriageId, reason, requesterName]
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Permintaan putus hubungan telah dikirim',
      request_id: result.rows[0].id,
    });
  } catch (error) {
    console.error('Create break request error:', error);
    return NextResponse.json(
      { error: 'Gagal membuat permintaan putus hubungan' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireAuth(request);

  if ('error' in auth) {
    return auth.error;
  }

  const { userId } = auth;
  const body = await request.json();
  const { request_id, action } = body;

  if (!request_id || !action || !['accept', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'request_id dan action (accept/reject) diperlukan' }, { status: 400 });
  }

  const client = await pool.connect();

  try {
    const brRes = await client.query(
      `SELECT br.id, br.marriage_id, br.requester_node_id, br.spouse_node_id
       FROM break_requests br
       JOIN nodes n ON n.id = br.spouse_node_id
       WHERE br.id = $1 AND n.user_id = $2 AND br.status = 'pending'`,
      [parseInt(request_id, 10), userId]
    );

    if (brRes.rows.length === 0) {
      return NextResponse.json({ error: 'Permintaan tidak ditemukan atau bukan untuk Anda' }, { status: 404 });
    }

    const breakRequest = brRes.rows[0];

    if (action === 'reject') {
      await client.query(
        `UPDATE break_requests SET status = 'rejected', updated_at = NOW() WHERE id = $1`,
        [parseInt(request_id, 10)]
      );
      return NextResponse.json({ success: true, message: 'Permintaan ditolak' });
    }

    await client.query('BEGIN');

    try {
      const marriageId = breakRequest.marriage_id;

      await client.query(
        `UPDATE marriages SET status = 'divorced', updated_at = NOW() WHERE id = $1`,
        [marriageId]
      );

      await client.query(
        `UPDATE break_requests SET status = 'accepted', updated_at = NOW() WHERE id = $1`,
        [parseInt(request_id, 10)]
      );

      await client.query(
        `UPDATE nodes 
         SET current_marriage_id = NULL,
             updated_at = NOW()
         WHERE current_marriage_id = $1`,
        [marriageId]
      );

      await client.query('COMMIT');

      return NextResponse.json({
        success: true,
        message: 'Hubungan keluarga telah diputuskan',
        action: 'divorced',
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  } catch (error) {
    console.error('Respond to break request error:', error);
    return NextResponse.json(
      { error: 'Gagal memproses respons' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}