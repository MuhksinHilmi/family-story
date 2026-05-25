import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db_helper';
import { requireAuth } from '@/lib/auth';
import { 
  calculateFirstMarriagePosition, 
  calculateWifePosition, 
  calculateChildPosition, 
  canUpdatePositionForRelation 
} from '@/lib/tree/positioning';
import { 
  mergeExtendedGroupsOnMarriage,
  linkNodeToRelativeExtendedGroups 
} from '@/lib/family/extended-groups';

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);

  if ('error' in auth) {
    return auth.error;
  }

  const { userId } = auth;

  const body = await request.json();
  const { invitation_id, token } = body;

  if (!invitation_id && !token) {
    return NextResponse.json({ error: 'invitation_id atau token undangan diperlukan' }, { status: 400 });
  }

  const client = await pool.connect();

  try {
    // 1. Get current user's node
    const currentNodeRes = await client.query(
      'SELECT id, full_name, gender, current_nuclear_family_id, current_marriage_id FROM nodes WHERE user_id = $1 LIMIT 1',
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

    // 2. Find the invitation (support both direct UUID invites via id, and legacy share-link via token)
    let invitationRes;
    if (invitation_id) {
      invitationRes = await client.query(
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
         WHERE i.id = $1`,
        [invitation_id]
      );
    } else {
      invitationRes = await client.query(
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
    }

    if (invitationRes.rows.length === 0) {
      return NextResponse.json({ error: 'Undangan tidak ditemukan' }, { status: 404 });
    }

    const invitation = invitationRes.rows[0];

    // 3. Basic validation
    if (invitation.status !== 'pending') {
      return NextResponse.json({ error: 'Undangan sudah tidak aktif' }, { status: 400 });
    }

    // Only share-link invitations (those with token) have expiration.
    // Direct UUID invites to existing users have no token and never expire.
    if (invitation.token && invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
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

      // ========== POSITIONING LOGIC (Phase 2) ==========
      // Hanya pria yang mendapat posisi random saat pernikahan PERTAMA.
      // Istri selalu ditempatkan di sebelah kanan suami.
      const husbandPosRes = await client.query(
        'SELECT position_x, position_y FROM nodes WHERE id = $1',
        [husbandNodeId]
      );
      const husbandCurrentPos = husbandPosRes.rows[0];
      const hx = husbandCurrentPos ? Number(husbandCurrentPos.position_x) : 0;
      const hy = husbandCurrentPos ? Number(husbandCurrentPos.position_y) : 0;
      const husbandHasPosition = (hx !== 0 || hy !== 0);

      let husbandPosition: { x: number; y: number };
      let wifePosition: { x: number; y: number };

      if (!husbandHasPosition) {
        // Pernikahan pertama untuk pria ini → berikan posisi random yang wajar
        husbandPosition = calculateFirstMarriagePosition({ id: husbandNodeId });
        wifePosition = calculateWifePosition(husbandPosition);
      } else {
        // Pria sudah punya posisi (pernikahan sebelumnya / drag manual)
        husbandPosition = { x: hx, y: hy };
        wifePosition = calculateWifePosition(husbandPosition);
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
             position_x = CASE 
               WHEN id = $3 THEN $5 
               WHEN id = $4 THEN $7 
               ELSE position_x 
             END,
             position_y = CASE 
               WHEN id = $3 THEN $6 
               WHEN id = $4 THEN $8 
               ELSE position_y 
             END,
             updated_at = NOW()
         WHERE id IN ($3, $4)`,
        [
          familyId, 
          marriageId, 
          husbandNodeId, 
          wifeNodeId,
          husbandPosition.x,
          husbandPosition.y,
          wifePosition.x,
          wifePosition.y
        ]
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

       // A1.2: Otomatis hubungkan / gabungkan Extended Family Group saat pernikahan
       await mergeExtendedGroupsOnMarriage(client, husbandNodeId, wifeNodeId);

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

       // Flag ini penting untuk positioning dan family membership
       const receiverIsAlreadyMarried = !!receiverNode.current_marriage_id;

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

      // Buat relasi parent-child (selalu dibuat untuk visualisasi hubungan biologis)
      await client.query(
        `INSERT INTO parent_child_relations (parent_node_id, child_node_id, parent_type, created_at)
         VALUES ($1, $2, $3, NOW())`,
        [inviterNodeId, receiverNodeId, parentType]
      );

      // Update nuclear family snapshot (father-centric) untuk kedua pihak
      // Ini memastikan anak langsung melihat keluarga inti ayah yang aktif
      await client.query(`SELECT rebuild_active_nuclear_viewers($1)`, [inviterNodeId]);
      await client.query(`SELECT rebuild_active_nuclear_viewers($1)`, [receiverNodeId]);

      // A4: Wariskan extended family group dari orang tua yang mengundang
      // Contoh kasus: Ayah baru diundang oleh anaknya (istri) yang sudah menikah
      // → Ayah otomatis masuk ke extended group keluarga besar.
      await linkNodeToRelativeExtendedGroups(client, receiverNodeId, inviterNodeId);

      // Pastikan cache extended_group_ids inviter juga ter-update (penting untuk user lama
      // yang join sebelum fitur extended group di-sync otomatis).
      await client.query(
        `UPDATE nodes 
         SET extended_group_ids = COALESCE((
           SELECT ARRAY_AGG(extended_group_id ORDER BY extended_group_id)
           FROM node_extended_groups 
           WHERE node_id = $1
         ), '{}'),
         updated_at = NOW()
         WHERE id = $1`,
        [inviterNodeId]
      );

      // ========== POSITIONING LOGIC FOR CHILD (Phase 3) ==========
      // Hanya ayah yang boleh mengatur posisi anak.
      // Ibu mengundang → tidak ubah posisi.
      // Anak yang sudah menikah → posisinya terkunci ke pasangan (tidak boleh diubah ayah).
      let childPositionUpdated = false;

      if (inviterGender === 'male' && !receiverIsAlreadyMarried) {
        const canUpdate = canUpdatePositionForRelation(
          { gender: receiverGender, current_marriage_id: receiverNode.current_marriage_id },
          'child',
          inviterGender
        );

        if (canUpdate) {
          // Ambil posisi ayah saat ini
          const fatherPosRes = await client.query(
            'SELECT position_x, position_y FROM nodes WHERE id = $1',
            [inviterNodeId]
          );
          const fatherPos = fatherPosRes.rows[0];

          if (fatherPos) {
            const fx = Number(fatherPos.position_x) || 0;
            const fy = Number(fatherPos.position_y) || 0;
            // Untuk sekarang kita pakai index 0 (bisa dikembangkan dengan sibling count nanti)
            const newChildPos = calculateChildPosition({ x: fx, y: fy }, 0);

            await client.query(
              `UPDATE nodes 
               SET position_x = $1, position_y = $2, updated_at = NOW()
               WHERE id = $3`,
              [newChildPos.x, newChildPos.y, receiverNodeId]
            );

            childPositionUpdated = true;
          }
        }
      }

      let familyUpdated = false;
      let familyId = null;

      // === ATURAN BARU ===
       // Hanya pindahkan orang ke keluarga ayah/ibu jika dia BELUM menikah.
       // Jika sudah menikah (punya pasangan), cukup buat relasi biologis saja.
       // Orang yang sudah berkeluarga tetap stay di keluarganya sendiri (suami/istri).
       if (!receiverIsAlreadyMarried) {
        // === CHILD: Logic sinkron dengan register ===
        // Hanya ayah yang mengatur family membership dan birth_order
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

          // Pastikan ayah (inviter) juga terdaftar sebagai head di keluarga ini
          await client.query(
            `UPDATE nodes SET current_nuclear_family_id = $1, updated_at = NOW() WHERE id = $2`,
            [familyId, inviterNodeId]
          );

          await client.query(
            `INSERT INTO nuclear_family_memberships 
               (nuclear_family_id, node_id, role, join_reason, joined_at)
             VALUES ($1, $2, 'head', 'birth', NOW())
             ON CONFLICT (nuclear_family_id, node_id) DO NOTHING`,
            [familyId, inviterNodeId]
          );

          // Tambahkan anak sebagai child
          await client.query(
            `INSERT INTO nuclear_family_memberships 
               (nuclear_family_id, node_id, role, join_reason, joined_at)
             VALUES ($1, $2, 'child', 'birth', NOW())
             ON CONFLICT (nuclear_family_id, node_id) DO NOTHING`,
            [familyId, receiverNodeId]
          );

          // birth_order sudah tidak disimpan di tabel nodes (new schema)
          // Urutan anak sekarang dihitung secara dinamis saat query tree jika diperlukan.

          familyUpdated = true;

        } else {
          // Ibu mengundang
          // Jika anak belum menikah, baru tambahkan ke family
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
        }
      } else {
        // Penerima sudah menikah → hanya buat relasi biologis/visualisasi.
        // Tidak memindahkan membership ke keluarga ayah/ibu.
        // Wanita tetap ikut keluarga suami, pria tetap head keluarganya sendiri.
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
    console.error('Accept invitation error:', error);
    return NextResponse.json(
      { error: 'Gagal menerima undangan' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
