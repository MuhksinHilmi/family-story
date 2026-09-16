import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db_helper";
import { requireAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const user_id = searchParams.get("user_id");
  const family_id = searchParams.get("family_id"); // integer nuclear_family_id

  try {
    if (user_id) {
      if (String(user_id) !== String(auth.userId)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }

      // Mode 1: ambil semua nuclear family yang user ikuti + chat room general-nya
      const result = await pool.query(
        `SELECT 
           nf.id        AS family_id,
           nf.uuid      AS family_uuid,
           nf.name      AS family_name,
           nfm.role,
           nfm.joined_at,
           cr.id        AS chat_room_id,
           cr.scope_type AS chat_scope
         FROM nuclear_family_memberships nfm
         JOIN nuclear_families nf ON nf.id = nfm.nuclear_family_id
         JOIN nodes n ON n.id = nfm.node_id
         LEFT JOIN chat_rooms cr ON cr.family_uuid = nf.uuid AND cr.scope_type = 'general'
         WHERE n.user_id = $1 AND nfm.left_at IS NULL`,
        [user_id],
      );
      return NextResponse.json(result.rows, { status: 200 });
    }

    if (family_id) {
      const fid = parseInt(family_id, 10);
      if (isNaN(fid)) {
        return NextResponse.json(
          { error: "family_id tidak valid" },
          { status: 400 },
        );
      }

      // Mode 2: daftar anggota nuclear family (dipakai halaman /members)
      const result = await pool.query(
        `SELECT
           u.id         AS id,
           u.full_name,
           u.email,
           u.phone,
           u.gender,
           u.birth_date,
           u.photo_url,
           nfm.role
         FROM nuclear_family_memberships nfm
         JOIN nodes n ON n.id = nfm.node_id
         LEFT JOIN users u ON u.id = n.user_id
         WHERE nfm.nuclear_family_id = $1
           AND nfm.left_at IS NULL
         ORDER BY nfm.joined_at ASC`,
        [fid],
      );

      const members = result.rows.map((row: any) => ({
        id: row.id,
        full_name: row.full_name || "Anggota Belum Daftar",
        email: row.email || "",
        phone: row.phone || undefined,
        gender: row.gender || undefined,
        birth_date: row.birth_date || undefined,
        photo_url: row.photo_url || undefined,
        role: row.role,
      }));

      return NextResponse.json({ members }, { status: 200 });
    }

    return NextResponse.json(
      { error: "user_id atau family_id diperlukan" },
      { status: 400 },
    );
  } catch (error) {
    console.error("Family members fetch error:", error);
    return NextResponse.json(
      { error: "Gagal mengambil data keluarga" },
      { status: 500 },
    );
  }
}
