import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db_helper';

export async function POST(request: NextRequest) {
  const client = await pool.connect();
  try {
    const body = await request.json();
    const { type, node_a_id, node_b_id, parent_id, child_id } = body;

    if (!type || !['spouse', 'child'].includes(type)) {
      return NextResponse.json({ error: 'type harus "spouse" atau "child"' }, { status: 400 });
    }

    await client.query('BEGIN');

    if (type === 'spouse') {
      if (!node_a_id || !node_b_id) {
        throw new Error('node_a_id dan node_b_id wajib untuk spouse');
      }

      // Ambil gender kedua node
      const nodesRes = await client.query(
        `SELECT id, gender, current_nuclear_family_id FROM nodes WHERE id IN ($1, $2)`,
        [node_a_id, node_b_id]
      );

      if (nodesRes.rows.length !== 2) throw new Error('Salah satu node tidak ditemukan');

      const nodeA = nodesRes.rows.find((r: any) => r.id == node_a_id);
      const nodeB = nodesRes.rows.find((r: any) => r.id == node_b_id);

      if (nodeA.gender === nodeB.gender) {
        throw new Error('Pasangan harus berbeda jenis kelamin');
      }

      // Cek apakah sudah menikah
      const existing = await client.query(
        `SELECT 1 FROM marriages 
         WHERE ((husband_node_id = $1 AND wife_node_id = $2) OR (husband_node_id = $2 AND wife_node_id = $1))
           AND status = 'married'`,
        [node_a_id, node_b_id]
      );
      if (existing.rows.length > 0) throw new Error('Keduanya sudah terikat pernikahan aktif');

      const husbandId = nodeA.gender === 'male' ? nodeA.id : nodeB.id;
      const wifeId = nodeA.gender === 'male' ? nodeB.id : nodeA.id;

      // Buat marriage
      const marriageRes = await client.query(
        `INSERT INTO marriages (husband_node_id, wife_node_id, status, created_at, updated_at)
         VALUES ($1, $2, 'married', NOW(), NOW()) RETURNING id`,
        [husbandId, wifeId]
      );
      const marriageId = marriageRes.rows[0].id;

      // Tentukan nuclear family (prioritas: salah satu yang sudah punya, atau buat baru milik suami)
      let familyId = nodeA.current_nuclear_family_id || nodeB.current_nuclear_family_id;

      if (!familyId) {
        const famRes = await client.query(
          `INSERT INTO nuclear_families (name, created_by_node_id, status, created_at, updated_at)
           VALUES ($1, $2, 'active', NOW(), NOW()) RETURNING id`,
          ['Keluarga Baru', husbandId]
        );
        familyId = famRes.rows[0].id;
      }

      // Update current fields
      await client.query(
        `UPDATE nodes 
         SET current_marriage_id = $1, current_nuclear_family_id = $2, updated_at = NOW()
         WHERE id IN ($3, $4)`,
        [marriageId, familyId, husbandId, wifeId]
      );

      // Memberships
      await client.query(
        `INSERT INTO nuclear_family_memberships (nuclear_family_id, node_id, role, join_reason, joined_at)
         VALUES ($1, $2, 'head', 'marriage', NOW())
         ON CONFLICT (nuclear_family_id, node_id) DO NOTHING`,
        [familyId, husbandId]
      );
      await client.query(
        `INSERT INTO nuclear_family_memberships (nuclear_family_id, node_id, role, join_reason, joined_at)
         VALUES ($1, $2, 'spouse', 'marriage', NOW())
         ON CONFLICT (nuclear_family_id, node_id) DO NOTHING`,
        [familyId, wifeId]
      );

    } else if (type === 'child') {
      if (!parent_id || !child_id) {
        throw new Error('parent_id dan child_id wajib untuk child');
      }

      const parentRes = await client.query(
        `SELECT id, gender, current_nuclear_family_id FROM nodes WHERE id = $1`,
        [parent_id]
      );
      if (parentRes.rows.length === 0) throw new Error('Parent tidak ditemukan');

      const parent = parentRes.rows[0];
      const parentType = parent.gender === 'male' ? 'father' : 'mother';

      // Cek duplikat relasi
      const dup = await client.query(
        `SELECT 1 FROM parent_child_relations WHERE parent_node_id = $1 AND child_node_id = $2 AND parent_type = $3`,
        [parent_id, child_id, parentType]
      );
      if (dup.rows.length > 0) throw new Error('Relasi orang tua-anak ini sudah ada');

      // Insert relasi
      await client.query(
        `INSERT INTO parent_child_relations (parent_node_id, child_node_id, parent_type, created_at)
         VALUES ($1, $2, $3, NOW())`,
        [parent_id, child_id, parentType]
      );

      // Jika ayah → atur family + birth_order (mirip accept)
      if (parent.gender === 'male') {
        let familyId = parent.current_nuclear_family_id;

        if (!familyId) {
          const famRes = await client.query(
            `INSERT INTO nuclear_families (name, created_by_node_id, status, created_at, updated_at)
             VALUES ($1, $2, 'active', NOW(), NOW()) RETURNING id`,
            ['Keluarga Baru', parent_id]
          );
          familyId = famRes.rows[0].id;
        }

        await client.query(
          `UPDATE nodes SET current_nuclear_family_id = $1, updated_at = NOW() WHERE id = $2`,
          [familyId, child_id]
        );

        await client.query(
          `INSERT INTO nuclear_family_memberships (nuclear_family_id, node_id, role, join_reason, joined_at)
           VALUES ($1, $2, 'child', 'birth', NOW())
           ON CONFLICT (nuclear_family_id, node_id) DO NOTHING`,
          [familyId, child_id]
        );

        // Hitung birth_order
        const countRes = await client.query(
          `SELECT COUNT(*) FROM parent_child_relations WHERE parent_node_id = $1 AND parent_type = 'father'`,
          [parent_id]
        );
        const birthOrder = parseInt(countRes.rows[0].count, 10);

        await client.query(
          `UPDATE nodes SET birth_order = $1, updated_at = NOW() WHERE id = $2`,
          [birthOrder, child_id]
        );
      }
      // Jika ibu → hanya relasi (sesuai aturan yang sudah ada)
    }

    await client.query('COMMIT');

    return NextResponse.json({ success: true, message: `${type} connection created` });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Tree connect error:', error);
    return NextResponse.json({ error: error.message || 'Gagal menghubungkan' }, { status: 400 });
  } finally {
    client.release();
  }
}
