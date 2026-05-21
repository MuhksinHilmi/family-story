import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db_helper';

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
      const a = parseInt(nodeId, 10);
      const b = parseInt(target_id, 10);
      const nodeA = Math.min(a, b);
      const nodeB = Math.max(a, b);

      await pool.query(
        `INSERT INTO spouse_relations (family_id, node_a, node_b, created_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (node_a, node_b) DO NOTHING`,
        [family_id, nodeA, nodeB]
      );

      return NextResponse.json({ message: 'Hubungan suami/istri dibuat' }, { status: 200 });
    }

    if (type === 'child') {
        const parentIdInt = parseInt(nodeId, 10);
      const childIdInt = parseInt(target_id, 10);

      if (parentIdInt === childIdInt) {
        return NextResponse.json({ error: 'Parent and child cannot be the same' }, { status: 400 });
      }

      const nodeResult = await pool.query(
        'SELECT id, gender, father_id, mother_id FROM family_nodes WHERE id = $1',
        [parentIdInt]
      );

      if (nodeResult.rows.length === 0) {
        return NextResponse.json(
          { error: 'Node tidak ditemukan' },
          { status: 404 }
        );
      }

      const parent = nodeResult.rows[0];

      const childResult = await pool.query('SELECT id, father_id, mother_id FROM family_nodes WHERE id = $1', [childIdInt]);
      if (childResult.rows.length === 0) {
        return NextResponse.json({ error: 'Target child node tidak ditemukan' }, { status: 404 });
      }

      const child = childResult.rows[0];

      // Prevent immediate cycles: don't allow setting parent if child is already parent of the parent
      if (parent.father_id === child.id || parent.mother_id === child.id) {
        return NextResponse.json({ error: 'Koneksi menimbulkan siklus, dibatalkan' }, { status: 400 });
      }

      const gender = parent.gender;

      console.log('[POST /api/tree/:id/connect] connect child request', { parentIdInt, childIdInt, type, family_id, gender });

      // If child already has the same parent, no-op
      if ((gender === 'male' && child.father_id === parentIdInt) || (gender === 'female' && child.mother_id === parentIdInt)) {
        return NextResponse.json({ message: 'Already connected' }, { status: 200 });
      }

      // Do not overwrite an existing different parent
      if (gender === 'male') {
        if (child.father_id && child.father_id !== parentIdInt) {
          return NextResponse.json({ error: 'Anak sudah memiliki ayah lain' }, { status: 400 });
        }
      } else {
        if (child.mother_id && child.mother_id !== parentIdInt) {
          return NextResponse.json({ error: 'Anak sudah memiliki ibu lain' }, { status: 400 });
        }
      }

      // Prevent immediate reciprocal parent-child (child already parent of parent)
      if (parent.father_id === child.id || parent.mother_id === child.id) {
        return NextResponse.json({ error: 'Koneksi menimbulkan siklus, dibatalkan' }, { status: 400 });
      }

      // Update the child record's parent field
      const updateResult = await pool.query(
        `UPDATE family_nodes SET 
           ${gender === 'male' ? 'father_id' : 'mother_id'} = $1,
           updated_at = NOW()
         WHERE id = $2`,
        [parentIdInt, childIdInt]
      );

      console.log('[POST /api/tree/:id/connect] updateResult', { rowCount: updateResult.rowCount });

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