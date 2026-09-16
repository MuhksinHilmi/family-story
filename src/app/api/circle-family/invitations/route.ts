import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db_helper";
import { requireAuth } from "@/lib/auth";
import { randomUUID } from "crypto";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status") || "pending";

    // Query invitations where target nuclear family head is the current user
    const invitationsRes = await pool.query(
      `SELECT hi.id, hi.target_nuclear_family_id, hi.sender_node_id,
              hi.theme, hi.suggested_skills, hi.created_at, hi.status,
              s.full_name as inviter_name,
              sf.name as inviter_family
       FROM halaqah_invites hi
       JOIN nodes s ON hi.sender_node_id = s.id
       LEFT JOIN nuclear_family_memberships snfm ON s.id = snfm.node_id
                                                AND snfm.left_at IS NULL
       LEFT JOIN nuclear_families sf ON snfm.nuclear_family_id = sf.id
       WHERE hi.target_nuclear_family_id = $1 AND hi.status = $2
       ORDER BY hi.created_at DESC`,
      [auth.nuclearFamilyId, status],
    );

    const invitations = invitationsRes.rows.map((inv: any) => ({
      id: inv.id,
      halaqah_name: `Halaqah ${inv.theme || "Belajar"}`,
      inviter_name: inv.inviter_name || "Unknown",
      inviter_family: inv.inviter_family || "Unknown",
      theme: inv.theme,
      suggested_skills: inv.suggested_skills || [],
      created_at: inv.created_at,
      status: inv.status,
    }));

    return NextResponse.json({ invitations });
  } catch (error) {
    console.error("Get invitations error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const body = await request.json();
    const { invitationId, action } = body;

    if (!invitationId || !action) {
      return NextResponse.json(
        { error: "ID undangan dan aksi diperlukan" },
        { status: 400 },
      );
    }

    await pool.query("BEGIN");

    try {
      // Fetch the invitation
      const inviteRes = await pool.query(
        `SELECT * FROM halaqah_invites WHERE id = $1 AND status = 'pending'`,
        [invitationId],
      );
      const invite = inviteRes.rows[0];

      if (!invite) {
        throw new Error("Undangan tidak ditemukan atau sudah diproses");
      }

      // Verify user has access to the target nuclear family
      const familyCheck = await pool.query(
        `SELECT 1 FROM nuclear_family_memberships WHERE nuclear_family_id = $1 AND node_id IN 
         (SELECT id FROM nodes WHERE user_id = $2)`,
        [invite.target_nuclear_family_id, auth.userId],
      );

      if (familyCheck.rowCount === 0) {
        throw new Error("Akses ditolak");
      }

      if (action === "accept") {
        // 1. Identify the two nuclear families involved
        const senderNodeRes = await pool.query(
          `SELECT current_nuclear_family_id FROM nodes WHERE id = $1`,
          [invite.sender_node_id],
        );
        const senderNfId = senderNodeRes.rows[0]?.current_nuclear_family_id;
        const targetNfId = invite.target_nuclear_family_id;

        // 2. Create the Halaqah group
        const halaqahRes = await pool.query(
          `INSERT INTO halaqahs
          (nuclear_family_id, name, description, type, topics, status)
          VALUES ($1, $2, $3, $4, $5, 'active')
          RETURNING id, uuid`,
          [
            targetNfId,
            `Halaqah ${invite.theme || "Belajar"}`,
            `Grup belajar bersama berdasarkan undangan.`,
            invite.theme || "umum",
            invite.suggested_skills || [],
          ],
        );
        const halaqah = halaqahRes.rows[0];

        // 3. Create the Chat Room
        const chatRoomUuid = randomUUID();
        await pool.query(
          `INSERT INTO chat_rooms (id, scope_type, name, created_at, updated_at)
           VALUES ($1, 'general', $2, NOW(), NOW())`,
          [chatRoomUuid, `Halaqah ${invite.theme || "Belajar"}`],
        );

        // Link chat room to halaqah
        await pool.query(
          `UPDATE halaqahs SET chat_room_uuid = $1 WHERE id = $2`,
          [chatRoomUuid, halaqah.id],
        );

        // 4. Add members to Halaqah and Chat Room
        const allNfIds = [senderNfId, targetNfId].filter(Boolean);

        // Get all users belonging to these nuclear families
        const membersRes = await pool.query(
          `SELECT n.user_id, n.id as node_id
           FROM nodes n
           JOIN nuclear_family_memberships nfm ON n.id = nfm.node_id
           WHERE nfm.nuclear_family_id = ANY($1::int[])`,
          [allNfIds],
        );
        const allMembers = membersRes.rows;

        for (const member of allMembers) {
          // Tentukan is_admin: true jika member adalah head dari target nuclear family
          const isAdmin =
            member.node_id ===
            (
              await pool.query(
                `SELECT nfm.node_id FROM nuclear_family_memberships nfm
                 WHERE nfm.nuclear_family_id = $1 AND nfm.role = 'head' AND nfm.left_at IS NULL
                 LIMIT 1`,
                [targetNfId],
              )
            ).rows[0]?.node_id;

          await pool
            .query(
              `INSERT INTO halaqah_members (halaqah_id, node_id, status, is_admin)
             VALUES ($1, $2, 'active', $3)`,
              [halaqah.id, member.node_id, isAdmin],
            )
            .catch(() => {});

          await pool
            .query(
              `INSERT INTO room_memberships (chat_room_id, user_id)
             VALUES ($1, $2)`,
              [chatRoomUuid, member.user_id],
            )
            .catch(() => {});
        }

        // 5. Mark invitation as accepted
        await pool.query(
          `UPDATE halaqah_invites SET status = 'accepted', updated_at = NOW() WHERE id = $1`,
          [invitationId],
        );

        await pool.query("COMMIT");
        return NextResponse.json({
          message: "Halaqah berhasil dibuat!",
          halaqahId: halaqah.id,
          chatRoomUuid: chatRoomUuid,
        });
      } else if (action === "reject") {
        await pool.query(
          `UPDATE halaqah_invites SET status = 'rejected', updated_at = NOW() WHERE id = $1`,
          [invitationId],
        );
        await pool.query("COMMIT");
        return NextResponse.json({ message: "Undangan berhasil ditolak" });
      }

      throw new Error("Aksi tidak valid");
    } catch (error: any) {
      await pool.query("ROLLBACK");
      console.error("Accept/Reject Invite error:", error);
      return NextResponse.json(
        { error: error.message || "Terjadi kesalahan" },
        { status: 500 },
      );
    }
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
