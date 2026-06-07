import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db_helper';
import { requireAuth } from '@/lib/auth';

type Action = 'accept' | 'reject';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { action } = body;

  // Get request_id from params, not body
  const requestId = parseInt((await params).id, 10);

  if (!action || !['accept', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'action (accept/reject) diperlukan' }, { status: 400 });
  }

  const client = await pool.connect();

  try {
    // Get the request and verify user is the spouse
    const reqRes = await client.query(
      `SELECT id, requester_node_id, spouse_node_id, marriage_id, status
       FROM break_requests WHERE id = $1`,
      [requestId]
    );

    if (reqRes.rows.length === 0) {
      return NextResponse.json({ error: 'Permintaan tidak ditemukan' }, { status: 404 });
    }

    const req = reqRes.rows[0];

    if (req.status !== 'pending') {
      return NextResponse.json({ error: 'Permintaan sudah diproses' }, { status: 400 });
    }

    // Verify this user is the spouse who needs to accept
    const spouseNodeRes = await client.query(
      `SELECT user_id FROM nodes WHERE id = $1`,
      [req.spouse_node_id]
    );

    if (spouseNodeRes.rows.length === 0) {
      return NextResponse.json({ error: 'Node pasangan tidak ditemukan' }, { status: 404 });
    }

    const spouseNode = spouseNodeRes.rows[0];
    if (spouseNode.user_id !== userId) {
      return NextResponse.json({ error: 'Hanya pasangan yang bisa merespons permintaan ini' }, { status: 403 });
    }

    if (action === 'accept') {
      // Update request status
      await client.query(
        `UPDATE break_requests SET status = 'accepted', updated_at = NOW() WHERE id = $1`,
        [requestId]
      );

      // Delete the marriage
      await client.query(
        `DELETE FROM marriages WHERE id = $1`,
        [req.marriage_id]
      );

      // Clear references in nodes
      await client.query(
        `UPDATE nodes SET current_marriage_id = NULL, updated_at = NOW() 
         WHERE current_marriage_id = $1`,
        [req.marriage_id]
      );

      // Remove nuclear family memberships for both (they leave their families)
      await client.query(
        `UPDATE nuclear_family_memberships SET left_at = NOW() 
         WHERE node_id IN ($1, $2) AND left_at IS NULL`,
        [req.requester_node_id, req.spouse_node_id]
      );

      // Clear current nuclear family refs
      await client.query(
        `UPDATE nodes SET current_nuclear_family_id = NULL, updated_at = NOW() 
         WHERE id IN ($1, $2)`,
        [req.requester_node_id, req.spouse_node_id]
      );
    } else {
      // Reject - just update status
      await client.query(
        `UPDATE break_requests SET status = 'rejected', updated_at = NOW() WHERE id = $1`,
        [requestId]
      );
    }

    return NextResponse.json({
      success: true,
      message: action === 'accept' 
        ? 'Hubungan pernikahan berhasil diputuskan' 
        : 'Permintaan ditolak',
    });
  } catch (error) {
    console.error('Process break request error:', error);
    return NextResponse.json(
      { error: 'Gagal memproses permintaan' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}