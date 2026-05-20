import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { node_a, node_b, type } = body;

    if (!node_a || !node_b) {
      return NextResponse.json(
        { error: 'node_a dan node_b diperlukan' },
        { status: 400 }
      );
    }

    if (type === 'spouse') {
      await pool.query(
        'DELETE FROM spouse_relations WHERE node_a = $1 AND node_b = $2',
        [parseInt(node_a), parseInt(node_b)]
      );
      return NextResponse.json({ message: 'Hubungan suami/istri dihapus' }, { status: 200 });
    }

    if (type === 'child') {
      const parentGenderResult = await pool.query(
        'SELECT gender FROM family_nodes WHERE id = $1',
        [parseInt(node_a)]
      );

      if (parentGenderResult.rows.length === 0) {
        return NextResponse.json(
          { error: 'Node orang tua tidak ditemukan' },
          { status: 404 }
        );
      }

      const parentGender = parentGenderResult.rows[0].gender;

      await pool.query(
        `UPDATE family_nodes SET 
           ${parentGender === 'male' ? 'father_id' : 'mother_id'} = NULL 
         WHERE id = $1`,
        [parseInt(node_b)]
      );

      await pool.query(
        `UPDATE family_nodes SET 
           father_id = NULL, mother_id = NULL 
         WHERE id = $1 AND ${parentGender === 'male' ? 'father_id' : 'mother_id'} = $2`,
        [parseInt(node_b), parseInt(node_a)]
      );

      return NextResponse.json({ message: 'Hubungan anak dihapus' }, { status: 200 });
    }

    return NextResponse.json(
      { error: 'Type harus spouse atau child' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Delete edge error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan' },
      { status: 500 }
    );
  }
}