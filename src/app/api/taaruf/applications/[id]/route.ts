import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db_helper";
import { requireAuth } from "@/lib/auth";

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { userId } = auth;
  const { id } = await context.params;
  const applicationId = parseInt(id);
  const body = await request.json();
  const { action, response_message } = body;

  if (!action || !["accept", "reject"].includes(action)) {
    return NextResponse.json(
      { error: 'action harus "accept" atau "reject"' },
      { status: 400 },
    );
  }

  if (!response_message || response_message.trim().length < 20) {
    return NextResponse.json(
      { error: "Pesan respons minimal 20 karakter" },
      { status: 400 },
    );
  }

  const client = await pool.connect();

  try {
    const appCheckRes = await client.query(
      `SELECT ta.id, ta.sender_profile_id, ta.recipient_profile_id, ta.status,
              sp.node_id as sender_node_id, sp.user_id as sender_user_id,
              sp.full_name as sender_name, rp.node_id as recipient_node_id,
              rp.user_id as recipient_user_id, rp.full_name as recipient_name,
              ta.chat_room_id, n.uuid as sender_node_uuid
       FROM taaruf_applications ta
       JOIN taaruf_profiles sp ON sp.id = ta.sender_profile_id
       JOIN taaruf_profiles rp ON rp.id = ta.recipient_profile_id
       JOIN nodes n ON n.id = sp.node_id
       WHERE ta.id = $1
       AND ta.status = 'pending'
       AND rp.user_id = $2`,
      [applicationId, userId],
    );

    if (appCheckRes.rows.length === 0) {
      return NextResponse.json(
        { error: "Lamaran tidak ditemukan atau bukan untuk Anda" },
        { status: 404 },
      );
    }

    const application = appCheckRes.rows[0];

    if (action === "reject") {
      await client.query(
        `UPDATE taaruf_applications 
         SET status = 'rejected', 
             response_message = $1,
             responded_at = NOW()
         WHERE id = $2`,
        [response_message.trim(), applicationId],
      );

      return NextResponse.json({
        success: true,
        message: "Lamaran telah ditolak",
        action: "rejected",
      });
    }

    await client.query("BEGIN");

    try {
      await client.query(
        `UPDATE taaruf_applications 
         SET status = 'accepted',
             response_message = $1,
             responded_at = NOW()
         WHERE id = $2`,
        [response_message.trim(), applicationId],
      );

      await client.query(
        `UPDATE taaruf_applications 
         SET status = 'cancelled', updated_at = NOW()
         WHERE sender_profile_id = $1 
         AND status = 'pending' 
         AND id != $2`,
        [application.sender_profile_id, applicationId],
      );

      await client.query(
        `UPDATE taaruf_applications 
         SET status = 'cancelled', updated_at = NOW()
         WHERE recipient_profile_id = $1 
         AND status = 'pending' 
         AND id != $2`,
        [application.recipient_profile_id, applicationId],
      );

      const [senderNodeRes, recipientNodeRes] = await Promise.all([
        client.query(
          `SELECT n.id, n.uuid, n.current_nuclear_family_id
           FROM nodes n
           WHERE n.id = $1`,
          [application.sender_node_id],
        ),
        client.query(
          `SELECT n.id, n.uuid, n.current_nuclear_family_id
           FROM nodes n
           WHERE n.id = $1`,
          [application.recipient_node_id],
        ),
      ]);

      const senderNode = senderNodeRes.rows[0];
      const recipientNode = recipientNodeRes.rows[0];

      const marriageRes = await client.query(
        `INSERT INTO marriages 
         (husband_node_id, wife_node_id, status, created_at, updated_at)
         VALUES ($1, $2, 'married', NOW(), NOW())
         RETURNING id`,
        [senderNode.id, recipientNode.id],
      );

      const marriageId = marriageRes.rows[0].id;

      const [senderFamilyRes, recipientFamilyRes] = await Promise.all([
        senderNode.current_nuclear_family_id
          ? client.query(
              `SELECT id, uuid FROM nuclear_families WHERE id = $1`,
              [senderNode.current_nuclear_family_id],
            )
          : Promise.resolve({ rows: [] }),
        recipientNode.current_nuclear_family_id
          ? client.query(
              `SELECT id, uuid FROM nuclear_families WHERE id = $1`,
              [recipientNode.current_nuclear_family_id],
            )
          : Promise.resolve({ rows: [] }),
      ]);

      const roomName = `Ta'aruf: ${application.sender_name} & ${application.recipient_name}`;
      const roomRes = await client.query(
        `INSERT INTO chat_rooms 
         (family_uuid, scope_type, name, created_at, updated_at)
         VALUES (gen_random_uuid(), 'small', $1, NOW(), NOW())
         RETURNING id, family_uuid`,
        [roomName],
      );

      const chatRoomId = roomRes.rows[0].id;
      const chatRoomUuid = roomRes.rows[0].family_uuid;

      await client.query(
        `INSERT INTO room_memberships (chat_room_id, user_id, created_at)
         SELECT $1, n.user_id, NOW()
         FROM nodes n
         WHERE n.id = $2
         ON CONFLICT DO NOTHING`,
        [chatRoomId, senderNode.id],
      );

      await client.query(
        `INSERT INTO room_memberships (chat_room_id, user_id, created_at)
         SELECT $1, n.user_id, NOW()
         FROM nodes n
         WHERE n.id = $2
         ON CONFLICT DO NOTHING`,
        [chatRoomId, recipientNode.id],
      );

      if (senderFamilyRes.rows[0]) {
        await client.query(
          `INSERT INTO room_memberships (chat_room_id, user_id, created_at)
           SELECT $1, n.user_id, NOW()
           FROM nuclear_family_memberships nfm
           JOIN nodes n ON n.id = nfm.node_id
           WHERE nfm.nuclear_family_id = $2
           AND n.user_id IS NOT NULL
           ON CONFLICT DO NOTHING`,
          [chatRoomId, senderNode.current_nuclear_family_id],
        );
      }

      if (recipientFamilyRes.rows[0]) {
        await client.query(
          `INSERT INTO room_memberships (chat_room_id, user_id, created_at)
           SELECT $1, n.user_id, NOW()
           FROM nuclear_family_memberships nfm
           JOIN nodes n ON n.id = nfm.node_id
           WHERE nfm.nuclear_family_id = $2
           AND n.user_id IS NOT NULL
           ON CONFLICT DO NOTHING`,
          [chatRoomId, recipientNode.current_nuclear_family_id],
        );
      }

      await client.query(
        `UPDATE taaruf_applications SET chat_room_id = $1 WHERE id = $2`,
        [chatRoomId, applicationId],
      );

      await client.query(
        `UPDATE nodes 
         SET current_marriage_id = $1,
             updated_at = NOW()
         WHERE id IN ($2, $3)`,
        [marriageId, senderNode.id, recipientNode.id],
      );

      const newFamilyRes = await client.query(
        `INSERT INTO nuclear_families 
         (uuid, name, created_by_node_id, status, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, 'active', NOW(), NOW())
         RETURNING id`,
        [
          `Keluarga ${application.sender_name} & ${application.recipient_name}`,
          senderNode.id,
        ],
      );

      const newFamilyId = newFamilyRes.rows[0].id;

      await client.query(
        `INSERT INTO nuclear_family_memberships 
         (nuclear_family_id, node_id, role, join_reason, joined_at)
         VALUES 
         ($1, $2, 'head', 'marriage', NOW()),
         ($1, $3, 'spouse', 'marriage', NOW())
         ON CONFLICT DO NOTHING`,
        [newFamilyId, senderNode.id, recipientNode.id],
      );

      await client.query(
        `UPDATE nodes 
         SET current_nuclear_family_id = $1,
             updated_at = NOW()
         WHERE id IN ($2, $3)`,
        [newFamilyId, senderNode.id, recipientNode.id],
      );

      await client.query("COMMIT");

      const now = new Date().toISOString();
      await client.query(
        `INSERT INTO messages 
         (id, chat_room_id, body, type, created_at)
         VALUES (gen_random_uuid(), $1, $2, 'system', $3)`,
        [
          chatRoomId,
          `Alhamdulillah — ${application.sender_name} dan ${application.recipient_name} telah terhubung. Semoga Allah meridhoi proses ta'aruf ini.`,
          now,
        ],
      );

      return NextResponse.json({
        success: true,
        message: "Lamaran diterima. Chat room telah dibuat.",
        chat_room: {
          id: chatRoomId,
          uuid: chatRoomUuid,
          name: roomName,
        },
      });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    }
  } catch (error) {
    console.error("PUT /api/taaruf/applications error:", error);
    return NextResponse.json(
      { error: "Gagal memproses respons lamaran" },
      { status: 500 },
    );
  } finally {
    client.release();
  }
}
