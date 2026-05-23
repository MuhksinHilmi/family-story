import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db_helper';
import { requireAuth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);

  if ('error' in auth) {
    return auth.error;
  }

  const { userId } = auth;

  const body = await request.json();
  const { token } = body;

  if (!token) {
    return NextResponse.json({ error: 'Token undangan diperlukan' }, { status: 400 });
  }

  const client = await pool.connect();

  try {
    // 1. Get current user's node
    const currentNodeRes = await client.query(
      'SELECT id, full_name, gender, current_nuclear_family_id FROM nodes WHERE user_id = $1 LIMIT 1',
      [userId]
    );

    if (currentNodeRes.rows.length === 0) {
      return NextResponse.json(
        { error: 'Anda belum memiliki node di sistem' },
        { status: 403 }
      );
    }

    const receiverNode = currentNodeRes.rows[0];
    const receiverNodeId = receiverNode.id;
    const receiverGender = receiverNode.gender;

    // 2. Find the invitation
    const invitationRes = await client.query(
      `SELECT 
        i.id, 
        i.invited_by_node_id, 
        i.relationship_type, 
        i.status, 
        i.expires_at,
        i.token,
        n.gender as inviter_gender,
        n.id as inviter_node_id
       FROM invitations i
       JOIN nodes n ON n.id = i.invited_by_node_id
       WHERE i.token = $1`,
      [token]
    );

    if (invitationRes.rows.length === 0) {
      return NextResponse.json({ error: 'Undangan tidak ditemukan' }, { status: 404 });
    }

    const invitation = invitationRes.rows[0];

    // 3. Basic validation
    if (invitation.status !== 'pending') {
      return NextResponse.json({ error: 'Undangan sudah tidak aktif' }, { status: 400 });
    }

    if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Undangan sudah kadaluarsa' }, { status: 400 });
    }

    // 4. Ensure the invitation is meant for this user
    const isForCurrentUser = await client.query(
      `SELECT 1 FROM invitations 
       WHERE id = $1 
         AND (invitee_node_id = $2 
              OR invitee_email = (SELECT email FROM users WHERE id = $3))`,
      [invitation.id, receiverNodeId, userId]
    );

    if (isForCurrentUser.rows.length === 0) {
      return NextResponse.json(
        { error: 'Undangan ini tidak ditujukan untuk Anda' },
        { status: 403 }
      );
    }

    const inviterNodeId = invitation.invited_by_node_id;
    const inviterGender = invitation.inviter_gender;

    await client.query('BEGIN');

    if (invitation.relationship_type === 'spouse') {
      // ========== SPOUSE LOGIC ==========
      if (receiverGender === inviterGender) {
        await client.query('ROLLBACK');
        return NextResponse.json(
          { error: 'Undangan pasangan hanya boleh untuk jenis kelamin berbeda' },
          { status: 400 }
        );
      }

      const husbandNodeId = inviterGender === 'male' ? inviterNodeId : receiverNodeId;
      const wifeNodeId = inviterGender === 'female' ? inviterNodeId : receiverNodeId;

      const existingMarriage = await client.query(
        `SELECT 1 FROM marriages 
         WHERE ((husband_node_id = $1 AND wife_node_id = $2) 
             OR (husband_node_id = $2 AND wife_node_id = $1))
           AND status = 'married'`,
        [husbandNodeId, wifeNodeId]
      );

      if (existingMarriage.rows.length > 0) {
        await client.query('ROLLBACK');
        return NextResponse.json({ error: 'Kalian sudah terikat dalam pernikahan aktif' }, { status: 409 });
      }

      const marriageRes = await client.query(
        `INSERT INTO marriages (husband_node_id, wife_node_id, status, created_at, updated_at)
         VALUES ($1, $2, 'married', NOW(), NOW())
         RETURNING id`,
        [husbandNodeId, wifeNodeId]
      );
      const marriageId = marriageRes.rows[0].id;

      let familyId = receiverNode.current_nuclear_family_id;

      if (receiverGender === 'male') {
        if (!receiverNode.current_nuclear_family_id) {
          const newFamily = await client.query(
            `INSERT INTO nuclear_families (name, created_by_node_id, status, created_at, updated_at)
             VALUES ($1, $2, 'active', NOW(), NOW())
             RETURNING id`,
            [`Keluarga ${receiverNode.full_name || 'Baru'}`, receiverNodeId]
          );
          familyId = newFamily.rows[0].id;
        } else {
          familyId = receiverNode.current_nuclear_family_id;
        }
      } else {
        const inviterCurrentFamily = await client.query(
          'SELECT current_nuclear_family_id FROM nodes WHERE id = $1',
          [inviterNodeId]
        );

        if (inviterCurrentFamily.rows[0]?.current_nuclear_family_id) {
          familyId = inviterCurrentFamily.rows[0].current_nuclear_family_id;
        } else {
          const newFamily = await client.query(
            `INSERT INTO nuclear_families (name, created_by_node_id, status, created_at, updated_at)
             VALUES ($1, $2, 'active', NOW(), NOW())
             RETURNING id`,
            [`Keluarga ${inviterGender === 'male' ? 'Suami' : 'Istri'}`, husbandNodeId]
          );
          familyId = newFamily.rows[0].id;
        }
      }

      await client.query(
        `UPDATE nodes 
         SET current_nuclear_family_id = $1, 
             current_marriage_id = $2,
             updated_at = NOW()
         WHERE id IN ($3, $4)`,
        [familyId, marriageId, husbandNodeId, wifeNodeId]
      );

      await client.query(
        `INSERT INTO nuclear_family_memberships 
           (nuclear_family_id, node_id, role, join_reason, joined_at)
         VALUES ($1, $2, 'head', 'marriage', NOW())
         ON CONFLICT (nuclear_family_id, node_id) DO NOTHING`,
        [familyId, husbandNodeId]
      );

      await client.query(
        `INSERT INTO nuclear_family_memberships 
           (nuclear_family_id, node_id, role, join_reason, joined_at)
         VALUES ($1, $2, 'spouse', 'marriage', NOW())
         ON CONFLICT (nuclear_family_id, node_id) DO NOTHING`,
        [familyId, wifeNodeId]
      );

      await client.query(
        `UPDATE invitations 
         SET status = 'accepted', 
             used_at = NOW(),
             updated_at = NOW()
         WHERE id = $1`,
        [invitation.id]
      );

      await client.query('COMMIT');

      return NextResponse.json({
        message: 'Undangan diterima. Selamat, kalian sekarang resmi berpasangan.',
        marriage_id: marriageId,
        nuclear_family_id: familyId,
      });

    } else if (invitation.relationship_type === 'child') {
      // ========== CHILD LOGIC ==========
      const parentType = inviterGender === 'male' ? 'father' : 'mother';

      // Cek apakah relasi sudah ada
      const existingRelation = await client.query(
        `SELECT 1 FROM parent_child_relations 
         WHERE parent_node_id = $1 AND child_node_id = $2 AND parent_type = $3`,
        [inviterNodeId, receiverNodeId, parentType]
      );

      if (existingRelation.rows.length > 0) {
        await client.query('ROLLBACK');
        return NextResponse.json(
          { error: 'Relasi orang tua-anak ini sudah ada' },
          { status: 409 }
        );
      }

      // Buat relasi parent-child
      await client.query(
        `INSERT INTO parent_child_relations (parent_node_id, child_node_id, parent_type, created_at)
         VALUES ($1, $2, $3, NOW())`,
        [inviterNodeId, receiverNodeId, parentType]
      );

      let familyUpdated = false;
      let familyId = null;

      // === CHILD: Logic sinkron dengan register ===
      // 3. Hanya ayah yang mengatur family membership dan birth_order
      if (inviterGender === 'male') {
        // Ayah mengundang → anak masuk ke keluarga ayah + tentukan urutan
        const inviterFamilyRes = await client.query(
          'SELECT current_nuclear_family_id FROM nodes WHERE id = $1',
          [inviterNodeId]
        );
        familyId = inviterFamilyRes.rows[0]?.current_nuclear_family_id;

        if (!familyId) {
          // Buat family baru untuk ayah
          const newFamily = await client.query(
            `INSERT INTO nuclear_families (name, created_by_node_id, status, created_at, updated_at)
             VALUES ($1, $2, 'active', NOW(), NOW())
             RETURNING id`,
            [`Keluarga Baru`, inviterNodeId]
          );
          familyId = newFamily.rows[0].id;
        }

        // Update current family anak
        await client.query(
          `UPDATE nodes SET current_nuclear_family_id = $1, updated_at = NOW() WHERE id = $2`,
          [familyId, receiverNodeId]
        );

        // Tambahkan sebagai child di family
        await client.query(
          `INSERT INTO nuclear_family_memberships 
             (nuclear_family_id, node_id, role, join_reason, joined_at)
           VALUES ($1, $2, 'child', 'birth', NOW())
           ON CONFLICT (nuclear_family_id, node_id) DO NOTHING`,
          [familyId, receiverNodeId]
        );

        // Tentukan birth_order (berdasarkan jumlah anak ayah saat ini)
        const birthOrderRes = await client.query(
          `SELECT COUNT(*) FROM parent_child_relations 
           WHERE parent_node_id = $1 AND parent_type = 'father'`,
          [inviterNodeId]
        );
        const birthOrder = parseInt(birthOrderRes.rows[0].count, 10);

        await client.query(
          `UPDATE nodes SET birth_order = $1, updated_at = NOW() WHERE id = $2`,
          [birthOrder, receiverNodeId]
        );

        familyUpdated = true;

      } else {
        // Ibu mengundang
        // Jika anak sudah punya keluarga, baru tambahkan ke family tersebut
        if (receiverNode.current_nuclear_family_id) {
          await client.query(
            `INSERT INTO nuclear_family_memberships 
               (nuclear_family_id, node_id, role, join_reason, joined_at)
             VALUES ($1, $2, 'child', 'birth', NOW())
             ON CONFLICT (nuclear_family_id, node_id) DO NOTHING`,
            [receiverNode.current_nuclear_family_id, receiverNodeId]
          );
          familyId = receiverNode.current_nuclear_family_id;
          familyUpdated = true;
        }
        // Jika anak belum punya keluarga → hanya relasi (tidak sentuh family)
      }

      await client.query(
        `UPDATE invitations 
         SET status = 'accepted', 
             used_at = NOW(),
             updated_at = NOW()
         WHERE id = $1`,
        [invitation.id]
      );

      await client.query('COMMIT');

      return NextResponse.json({
        message: 'Undangan sebagai anak diterima.',
        parent_type: parentType,
        family_updated: familyUpdated,
        nuclear_family_id: familyId,
      });

    } else {
      await client.query('ROLLBACK');
      return NextResponse.json(
        { error: 'Tipe undangan tidak dikenali' },
        { status: 400 }
      );
    }
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Accept spouse invitation error:', error);
    return NextResponse.json(
      { error: 'Gagal menerima undangan pasangan' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
