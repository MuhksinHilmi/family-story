import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const pathParts = request.nextUrl.pathname.split('/');
    const nodeId = pathParts[pathParts.length - 2];
    const body = await request.json();
    const { target_id, type, family_id } = body;

    if (!nodeId || !target_id || !type || !family_id) {
      return NextResponse.json(
        { error: 'nodeId, target_id, type, dan family_id wajib diisi' },
        { status: 400 }
      );
    }

    if (!['spouse', 'child'].includes(type)) {
      return NextResponse.json(
        { error: 'type harus spouse atau child' },
        { status: 400 }
      );
    }

    if (type === 'spouse') {
      await pool.query(
        `INSERT INTO spouse_relations (family_id, node_a, node_b, created_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (node_a, node_b) DO NOTHING`,
        [family_id, parseInt(nodeId), parseInt(target_id)]
      );

      return NextResponse.json({ message: 'Hubungan suami/istri dibuat' }, { status: 200 });
    }

    if (type === 'child') {
      const nodeResult = await pool.query(
        'SELECT gender FROM family_nodes WHERE id = $1',
        [parseInt(nodeId)]
      );

      if (nodeResult.rows.length === 0) {
        return NextResponse.json(
          { error: 'Node tidak ditemukan' },
          { status: 404 }
        );
      }

      const gender = nodeResult.rows[0].gender;

      await pool.query(
        `UPDATE family_nodes SET 
           ${gender === 'male' ? 'father_id' : 'mother_id'} = $1,
           updated_at = NOW()
         WHERE id = $2`,
        [parseInt(target_id), parseInt(nodeId)]
      );

      await pool.query(
        `UPDATE family_nodes SET 
           father_id = $1,
           mother_id = $2,
           updated_at = NOW()
         WHERE id = $3`,
        [gender === 'male' ? parseInt(nodeId) : null, gender === 'female' ? parseInt(nodeId) : null, parseInt(target_id)]
      );

      return NextResponse.json({ message: 'Anak terhubung' }, { status: 200 });
    }

    return NextResponse.json(
      { error: 'Type tidak valid' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Connect error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan' },
      { status: 500 }
    );
  }
}