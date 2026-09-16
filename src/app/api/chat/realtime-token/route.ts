import { NextRequest, NextResponse } from "next/server";
import { SignJWT } from "jose";
import { requireAuth } from "@/lib/auth";
import pool from "@/lib/db_helper";

/**
 * GET /api/chat/realtime-token
 *
 * Flow:
 *   1. Verifikasi custom app JWT (Authorization header)
 *   2. Ambil family_uuid user dari local DB
 *   3. Mint Supabase-compatible JWT (HS256, signed dengan SUPABASE_JWT_SECRET)
 *      dengan claims yang dibutuhkan untuk RLS Supabase Realtime
 *   4. Return token (short-lived, 2 jam)
 *
 * Token ini HANYA dipakai untuk subscribe Supabase Realtime channel.
 * Tidak bisa dipakai untuk operasi Supabase lain (RLS membatasi ke SELECT saja).
 *
 * Security:
 *   - Token expire dalam 2 jam, client fetch ulang kalau expired
 *   - family_uuids di-embed sebagai claim → RLS cek claim ini, bukan tabel
 *   - Tidak ada cara client bisa forging claim karena secret tidak pernah ke client
 */

const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET;
const TOKEN_TTL_SECONDS = 60 * 60 * 2; // 2 jam

export async function GET(request: NextRequest) {
  // 1. Verifikasi app JWT
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  if (!SUPABASE_JWT_SECRET) {
    console.error("[realtime-token] SUPABASE_JWT_SECRET tidak di-set");
    return NextResponse.json(
      { error: "Konfigurasi server tidak lengkap" },
      { status: 500 },
    );
  }

  const userUuid = auth.userUuid;

  try {
    // 2. Ambil semua family_uuid dari chat_rooms yang user ini punya akses.
    //    Tiga jalur akses:
    //    A) Extended family group → general rooms keluarga besar
    //    B) Node uuid = small_family_uuid → small room milik sendiri (kepala keluarga)
    //    C) Parent-child relation → small room keluarga inti ayah/ibu
    //       (tetap bisa akses meski sudah menikah dan bukan anggota aktif lagi)
    const familyRes = await pool.query<{ family_uuid: string }>(
      `-- Jalur A & B: via extended group dan small room sebagai kepala
       SELECT DISTINCT cr.family_uuid::text AS family_uuid
       FROM users u
       JOIN nodes n ON n.user_id = u.id
       LEFT JOIN node_extended_groups neg ON neg.node_id = n.id
       LEFT JOIN chat_rooms cr ON (
         cr.small_family_uuid = n.uuid
         OR cr.extended_group_id = neg.extended_group_id
       )
       WHERE u.uuid = $1
         AND cr.family_uuid IS NOT NULL

       UNION

       -- Jalur C: nuclear family sendiri yang aktif
       SELECT DISTINCT nf.uuid::text AS family_uuid
       FROM users u
       JOIN nodes n ON n.user_id = u.id
       JOIN nuclear_family_memberships nfm ON nfm.node_id = n.id
       JOIN nuclear_families nf ON nf.id = nfm.nuclear_family_id
       WHERE u.uuid = $1
         AND nfm.left_at IS NULL

       UNION

       -- Jalur D: small room via relasi parent-child
       -- Hilmi tetap bisa akses small room keluarga inti ayahnya setelah menikah
       SELECT DISTINCT cr.family_uuid::text AS family_uuid
       FROM users u
       JOIN nodes n ON n.user_id = u.id
       JOIN parent_child_relations pcr ON pcr.child_node_id = n.id
       JOIN nodes parent_node ON parent_node.id = pcr.parent_node_id
       JOIN chat_rooms cr ON cr.small_family_uuid = parent_node.uuid
                         AND cr.scope_type = 'small'
       WHERE u.uuid = $1
         AND cr.family_uuid IS NOT NULL`,
      [userUuid],
    );

    const familyUuids = familyRes.rows.map((r) => r.family_uuid);

    if (familyUuids.length === 0) {
      // Fallback: user mungkin belum punya chat room, tapi tetap return token kosong
      // daripada 403 yang membingungkan — channel subscribe akan gagal secara natural
      console.warn("[realtime-token] User tidak punya chat rooms:", userUuid);
      return NextResponse.json(
        { error: "User belum memiliki akses ke room chat manapun" },
        { status: 403 },
      );
    }

    // 3. Mint Supabase-compatible JWT
    //    Format claims mengikuti standar Supabase:
    //    - sub    : user UUID (wajib)
    //    - role   : "authenticated" (wajib agar RLS TO authenticated berlaku)
    //    - iss    : "supabase" (wajib — Supabase cek ini)
    //    - exp    : 2 jam dari sekarang
    //    - family_uuids: custom claim untuk RLS policy kita
    const secret = new TextEncoder().encode(SUPABASE_JWT_SECRET);
    const now = Math.floor(Date.now() / 1000);

    const realtimeToken = await new SignJWT({
      sub: userUuid,
      role: "authenticated",
      iss: "supabase",
      iat: now,
      exp: now + TOKEN_TTL_SECONDS,
      // Custom claims — dipakai di RLS policy realtime.messages
      family_uuids: familyUuids,
    })
      .setProtectedHeader({ alg: "HS256" })
      .sign(secret);

    return NextResponse.json({
      token: realtimeToken,
      expires_at: (now + TOKEN_TTL_SECONDS) * 1000, // ms, untuk client refresh timer
    });
  } catch (err: any) {
    console.error("[realtime-token] Error:", err);
    return NextResponse.json(
      { error: "Gagal generate realtime token" },
      { status: 500 },
    );
  }
}
