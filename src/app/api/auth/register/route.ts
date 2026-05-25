import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db_helper';
import { sendActivationLink } from '@/lib/email';
import { randomBytes, randomUUID } from 'crypto';
import { 
  mergeExtendedGroupsOnMarriage,
  linkNodeToRelativeExtendedGroups 
} from '@/lib/family/extended-groups';
import {
  calculateFirstMarriagePosition,
  calculateWifePosition,
  calculateChildPosition,
} from '@/lib/tree/positioning';

export async function POST(request: NextRequest) {
  const client = await pool.connect();
  try {
    const body = await request.json();
    const { full_name, email, phone, gender, birth_date, invite_token } = body;

    if (!full_name || !email || !gender) {
      return NextResponse.json(
        { error: 'Nama lengkap, email, dan gender wajib diisi' },
        { status: 400 }
      );
    }

    // Cek email sudah terdaftar
    const existingResult = await client.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );
    if (existingResult.rows.length > 0) {
      return NextResponse.json(
        { error: 'Email sudah terdaftar' },
        { status: 409 }
      );
    }

    // === Handle invitation for new user ===
    let invitation = null;

    if (invite_token) {
      const invRes = await client.query(
        `SELECT 
           id, 
           invited_by_node_id, 
           inviter_gender,
           relationship_type, 
           parent_node_id,
           status, 
           expires_at,
           invitee_email
         FROM invitations 
         WHERE token = $1`,
        [invite_token]
      );

      if (invRes.rows.length === 0) {
        return NextResponse.json({ error: 'Token undangan tidak valid' }, { status: 400 });
      }

      invitation = invRes.rows[0];

      if (invitation.status !== 'pending') {
        return NextResponse.json({ error: 'Undangan sudah tidak aktif' }, { status: 400 });
      }

      if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
        return NextResponse.json({ error: 'Undangan sudah kadaluarsa' }, { status: 400 });
      }

      if (invitation.invitee_email !== email) {
        return NextResponse.json(
          { error: 'Email yang didaftarkan tidak sesuai dengan undangan' },
          { status: 400 }
        );
      }

      // Validasi gender untuk spouse (harus berbeda dengan pengundang)
      if (invitation.relationship_type === 'spouse' && invitation.inviter_gender) {
        const expectedGender = invitation.inviter_gender === 'male' ? 'female' : 'male';

        if (gender !== expectedGender) {
          return NextResponse.json(
            { error: `Gender harus ${expectedGender} sesuai undangan pasangan` },
            { status: 400 }
          );
        }
      }
    }

    await client.query('BEGIN');

    const activationToken = randomBytes(32).toString('hex');
    const userUuid = randomUUID();

    // 1. Buat user
    const userResult = await client.query(
      `INSERT INTO users 
        (uuid, full_name, email, phone, gender, birth_date, 
         is_email_verified, is_phone_verified, activation_token, activation_status, 
         created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, false, false, $7, 'pending', NOW(), NOW())
       RETURNING id, uuid, full_name, email, gender, birth_date`,
      [userUuid, full_name, email, phone, gender, birth_date, activationToken]
    );

    const user = userResult.rows[0];

    // 2. Buat node otomatis untuk user ini (self-registration)
    const newNodeRes = await client.query(
      `INSERT INTO nodes 
        (uuid, user_id, full_name, gender, birth_date, is_alive, 
         phone_is_public, birth_date_is_public, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, true, false, false, NOW(), NOW())
       RETURNING id`,
      [user.id, full_name, gender, birth_date]
    );

    const newNodeId = newNodeRes.rows[0].id;

    // === Claim invitation (jika ada) ===
    if (invitation) {
      const inviterNodeId = invitation.invited_by_node_id;
      const relationshipType = invitation.relationship_type;

      if (relationshipType === 'spouse') {
        // === SPOUSE: Buat marriage + nuclear family ===
        const inviterGender = invitation.inviter_gender;
        const husbandNodeId = inviterGender === 'male' ? inviterNodeId : newNodeId;
        const wifeNodeId = inviterGender === 'female' ? inviterNodeId : newNodeId;

        // ========== POSITIONING LOGIC (sama seperti jalur UUID accept) ==========
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
          husbandPosition = calculateFirstMarriagePosition({ id: husbandNodeId });
          wifePosition = calculateWifePosition(husbandPosition);
        } else {
          husbandPosition = { x: hx, y: hy };
          wifePosition = calculateWifePosition(husbandPosition);
        }

        // Buat marriage
        const marriageRes = await client.query(
          `INSERT INTO marriages (husband_node_id, wife_node_id, status, created_at, updated_at)
           VALUES ($1, $2, 'married', NOW(), NOW())
           RETURNING id`,
          [husbandNodeId, wifeNodeId]
        );
        const marriageId = marriageRes.rows[0].id;

        // Handle nuclear family (pria sebagai pemilik)
        let familyId = null;

        const inviterFamilyRes = await client.query(
          'SELECT current_nuclear_family_id FROM nodes WHERE id = $1',
          [inviterNodeId]
        );
        familyId = inviterFamilyRes.rows[0]?.current_nuclear_family_id;

        if (!familyId) {
          const newFamily = await client.query(
            `INSERT INTO nuclear_families (name, created_by_node_id, status, created_at, updated_at)
             VALUES ($1, $2, 'active', NOW(), NOW())
             RETURNING id`,
            [`Keluarga Baru`, husbandNodeId]
          );
          familyId = newFamily.rows[0].id;
        }

        // Update current fields + posisi (sama seperti jalur UUID)
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

        // Memberships
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

        // A4: Extended Family Group untuk jalur registrasi via email invite (new user)
        await mergeExtendedGroupsOnMarriage(client, husbandNodeId, wifeNodeId);
      }

      if (relationshipType === 'child') {
        // === CHILD: Logic sesuai aturan ===
        const parentType = invitation.inviter_gender === 'male' ? 'father' : 'mother';
        const parentNodeId = inviterNodeId;

        // 1. Selalu buat relasi orang tua - anak
        await client.query(
          `INSERT INTO parent_child_relations (parent_node_id, child_node_id, parent_type, created_at)
           VALUES ($1, $2, $3, NOW())`,
          [parentNodeId, newNodeId, parentType]
        );

        // Update nuclear family snapshot (father-centric)
        await client.query(`SELECT rebuild_active_nuclear_viewers($1)`, [parentNodeId]);
        await client.query(`SELECT rebuild_active_nuclear_viewers($1)`, [newNodeId]);

        // ========== POSITIONING LOGIC FOR CHILD (hanya ayah yang mengatur posisi) ==========
        // Sama seperti jalur UUID accept. Ibu tidak mengubah posisi anak.
        if (invitation.inviter_gender === 'male') {
          const fatherPosRes = await client.query(
            'SELECT position_x, position_y FROM nodes WHERE id = $1',
            [parentNodeId]
          );
          const fatherPos = fatherPosRes.rows[0];

          if (fatherPos) {
            const fx = Number(fatherPos.position_x) || 0;
            const fy = Number(fatherPos.position_y) || 0;

            const childPosition = calculateChildPosition({ x: fx, y: fy }, 0);

            await client.query(
              `UPDATE nodes 
               SET position_x = $1, position_y = $2, updated_at = NOW()
               WHERE id = $3`,
              [childPosition.x, childPosition.y, newNodeId]
            );
          }
        }

        // A4: Wariskan extended group dari orang tua yang mengundang (sama seperti jalur accept)
        await linkNodeToRelativeExtendedGroups(client, newNodeId, parentNodeId);

        // Pastikan cache inviter juga ter-update (untuk user lama)
        await client.query(
          `UPDATE nodes 
           SET extended_group_ids = COALESCE((
             SELECT ARRAY_AGG(extended_group_id ORDER BY extended_group_id)
             FROM node_extended_groups 
             WHERE node_id = $1
           ), '{}'),
           updated_at = NOW()
           WHERE id = $1`,
          [parentNodeId]
        );

        // 2. Hanya ayah yang mengatur family membership dan birth_order
        if (invitation.inviter_gender === 'male') {
          // Ayah mengundang → anak masuk ke keluarga ayah + tentukan urutan
          let familyId = null;

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
              [`Keluarga ${inviterNodeId}`, inviterNodeId]
            );
            familyId = newFamily.rows[0].id;
          }

          // Update current family anak
          await client.query(
            `UPDATE nodes SET current_nuclear_family_id = $1, updated_at = NOW() WHERE id = $2`,
            [familyId, newNodeId]
          );

          // Pastikan ayah juga terdaftar sebagai head
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
            [familyId, newNodeId]
          );

          // birth_order sudah tidak disimpan di tabel nodes (new schema)
          // Bisa dihitung dinamis dari parent_child_relations saat diperlukan.


         } else {

          // Ibu mengundang
          // Jika anak belum punya keluarga → hanya relasi (tidak sentuh family membership)
          // Jika anak sudah punya keluarga (misalnya dari ayah), kita tidak mengubahnya di sini
          // (sesuai aturan yang kamu berikan)
        }
      }

      // Tandai undangan sebagai accepted
      await client.query(
        `UPDATE invitations 
         SET status = 'accepted', used_at = NOW(), updated_at = NOW()
         WHERE id = $1`,
        [invitation.id]
      );
    }

    await client.query('COMMIT');

    // 3. Kirim link aktivasi email
    await sendActivationLink(email, activationToken);

    const isViaInvitation = !!invitation;

    return NextResponse.json(
      {
        message: isViaInvitation
          ? 'Akun berhasil dibuat dan undangan telah diklaim. Silakan cek email untuk aktivasi.'
          : 'Akun berhasil dibuat. Silakan cek email untuk aktivasi.',
        user: {
          id: user.id,
          uuid: user.uuid,
          full_name: user.full_name,
          email: user.email,
        },
        via_invitation: isViaInvitation
      },
      { status: 201 }
    );
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Registration error (new schema):', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat registrasi' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}