import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db_helper';
import { requireAuth } from '@/lib/auth';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);

  if ('error' in auth) {
    return auth.error;
  }

  const { userId } = auth;

  const nodeId = (await params).id;
  const nodeIdInt = parseInt(nodeId, 10);

  if (isNaN(nodeIdInt)) {
    return NextResponse.json({ error: 'Node ID tidak valid' }, { status: 400 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body tidak valid' }, { status: 400 });
  }

  const { position_x, position_y } = body;

  if (typeof position_x !== 'number' || typeof position_y !== 'number') {
    return NextResponse.json(
      { error: 'position_x dan position_y harus berupa angka' },
      { status: 400 }
    );
  }

  const client = await pool.connect();

  try {
    // Cek apakah node ini milik user yang login
    const nodeRes = await client.query(
      `SELECT id, user_id FROM nodes WHERE id = $1`,
      [nodeIdInt]
    );

    if (nodeRes.rows.length === 0) {
      return NextResponse.json({ error: 'Node tidak ditemukan' }, { status: 404 });
    }

    const node = nodeRes.rows[0];

    // Sementara dimatikan untuk development (bisa pindah node orang lain / diri sendiri)
    // if (node.user_id !== userId) {
    //   return NextResponse.json(
    //     { error: 'Anda hanya boleh mengubah posisi node milik sendiri' },
    //     { status: 403 }
    //   );
    // }

    // Update hanya posisi
    await client.query(
      `UPDATE nodes 
       SET position_x = $1, position_y = $2, updated_at = NOW() 
       WHERE id = $3`,
      [position_x, position_y, nodeIdInt]
    );

    return NextResponse.json({
      success: true,
      message: 'Posisi node berhasil diperbarui',
      node_id: nodeIdInt,
      position_x,
      position_y,
    });
  } catch (error) {
    console.error('Update node position error:', error);
    return NextResponse.json(
      { error: 'Gagal memperbarui posisi node' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

// Optional: support PATCH as well (some clients prefer it)
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return PUT(request, context);
}
