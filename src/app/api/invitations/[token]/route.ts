import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db_helper";

/**
 * GET /api/invitations/[token]
 * Ambil detail undangan berdasarkan token.
 * Schema 2026-clean: tabel invitations punya token, status, expires_at,
 * invited_by_node_id, relationship_type, invitee_email, dll.
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.pathname.split("/").pop() || "";

    if (!token) {
      return NextResponse.json({ error: "token diperlukan" }, { status: 400 });
    }

    const result = await pool.query(
      `SELECT 
         i.id,
         i.token,
         i.status,
         i.expires_at,
         i.relationship_type,
         i.invitee_email         AS email,
         i.invited_by_node_id,
         i.inviter_gender,
         -- Info inviter
         inviter.full_name       AS inviter_name,
         inviter.gender          AS inviter_gender_node
       FROM invitations i
       LEFT JOIN nodes inviter ON inviter.id = i.invited_by_node_id
       WHERE i.token = $1`,
      [token],
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "Undangan tidak ditemukan" },
        { status: 404 },
      );
    }

    const inv = result.rows[0];
    const isExpired = inv.expires_at && new Date(inv.expires_at) < new Date();

    if (isExpired || inv.status !== "pending") {
      return NextResponse.json(
        { error: "Undangan tidak valid atau sudah kadaluarsa" },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        id: inv.id,
        token: inv.token,
        status: inv.status,
        expires_at: inv.expires_at,
        email: inv.email,
        relationship_type: inv.relationship_type,
        invitation: {
          invitee_email: inv.email,
          relationship_type: inv.relationship_type,
          inviter: {
            full_name: inv.inviter_name,
            gender: inv.inviter_gender_node || inv.inviter_gender,
          },
        },
        // Backward-compat fields for older UI code
        node: inv.inviter_name
          ? {
              full_name: inv.inviter_name,
              gender: inv.inviter_gender_node || inv.inviter_gender,
            }
          : null,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("GET /api/invitations/[token] error:", error);
    return NextResponse.json({ error: "Terjadi kesalahan" }, { status: 500 });
  }
}

/**
 * POST /api/invitations/[token]
 * Terima undangan untuk user yang SUDAH login (bukan registrasi baru).
 * Untuk user baru, alurnya lewat POST /api/auth/register dengan invite_token.
 * Schema 2026-clean: tidak ada family_nodes/family_members, relasi lewat nodes + marriages/parent_child_relations.
 */
export async function POST(request: NextRequest) {
  try {
    const token = request.nextUrl.pathname.split("/").pop() || "";
    const body = await request.json();
    const { user_id } = body;

    if (!token || !user_id) {
      return NextResponse.json(
        { error: "token dan user_id wajib diisi" },
        { status: 400 },
      );
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Ambil detail invitation
      const invRes = await client.query(
        `SELECT id, status, expires_at, invited_by_node_id, relationship_type, 
                inviter_gender, invitee_email
         FROM invitations 
         WHERE token = $1 AND status = 'pending'`,
        [token],
      );

      if (invRes.rows.length === 0) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          { error: "Undangan tidak valid atau sudah digunakan" },
          { status: 400 },
        );
      }

      const inv = invRes.rows[0];

      if (inv.expires_at && new Date(inv.expires_at) < new Date()) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          { error: "Undangan sudah kadaluarsa" },
          { status: 400 },
        );
      }

      // Cari node milik user yang sedang login
      const nodeRes = await client.query(
        "SELECT id FROM nodes WHERE user_id = $1 LIMIT 1",
        [user_id],
      );

      if (nodeRes.rows.length === 0) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          { error: "Node tidak ditemukan untuk user ini" },
          { status: 404 },
        );
      }

      const acceptorNodeId = nodeRes.rows[0].id;
      const inviterNodeId = inv.invited_by_node_id;

      // Proses sesuai relationship_type
      if (inv.relationship_type === "spouse") {
        const inviterGender = inv.inviter_gender;
        const husbandNodeId =
          inviterGender === "male" ? inviterNodeId : acceptorNodeId;
        const wifeNodeId =
          inviterGender === "female" ? inviterNodeId : acceptorNodeId;

        // Buat marriage
        await client.query(
          `INSERT INTO marriages (husband_node_id, wife_node_id, status, created_at, updated_at)
           VALUES ($1, $2, 'married', NOW(), NOW())
           ON CONFLICT DO NOTHING`,
          [husbandNodeId, wifeNodeId],
        );

        // Handle nuclear family
        const nfRes = await client.query(
          "SELECT current_nuclear_family_id FROM nodes WHERE id = $1",
          [inviterNodeId],
        );
        let familyId = nfRes.rows[0]?.current_nuclear_family_id;

        if (!familyId) {
          const newNf = await client.query(
            `INSERT INTO nuclear_families (name, created_by_node_id, status, created_at, updated_at)
             VALUES ('Keluarga Baru', $1, 'active', NOW(), NOW())
             RETURNING id`,
            [husbandNodeId],
          );
          familyId = newNf.rows[0].id;
        }

        await client.query(
          `UPDATE nodes SET current_nuclear_family_id = $1, updated_at = NOW() WHERE id IN ($2, $3)`,
          [familyId, husbandNodeId, wifeNodeId],
        );

        await client.query(
          `INSERT INTO nuclear_family_memberships (nuclear_family_id, node_id, role, join_reason, joined_at)
           VALUES ($1, $2, 'head', 'marriage', NOW()), ($1, $3, 'spouse', 'marriage', NOW())
           ON CONFLICT (nuclear_family_id, node_id) DO NOTHING`,
          [familyId, husbandNodeId, wifeNodeId],
        );
      } else if (inv.relationship_type === "child") {
        const parentType = inv.inviter_gender === "male" ? "father" : "mother";
        await client.query(
          `INSERT INTO parent_child_relations (parent_node_id, child_node_id, parent_type, created_at)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT DO NOTHING`,
          [inviterNodeId, acceptorNodeId, parentType],
        );
      }

      // Tandai invitation accepted
      await client.query(
        `UPDATE invitations SET status = 'accepted', used_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [inv.id],
      );

      await client.query("COMMIT");
      return NextResponse.json(
        { message: "Undangan berhasil diterima" },
        { status: 200 },
      );
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("POST /api/invitations/[token] error:", error);
    return NextResponse.json({ error: "Terjadi kesalahan" }, { status: 500 });
  }
}
