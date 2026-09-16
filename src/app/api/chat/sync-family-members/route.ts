import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { initSupabaseServer } from "@/lib/supabase-server";
import pool from "@/lib/db_helper";

/**
 * POST /api/chat/sync-family-members
 *
 * Sync semua family_uuid yang user ini punya akses
 * dari local DB ke tabel public.family_members di Supabase.
 *
 * Dipanggil otomatis saat user buka /chat.
 * RLS Supabase Realtime cek tabel ini untuk authorize subscribe.
 *
 * Akses yang disync:
 *   - General rooms via extended_family_groups
 *   - Small rooms via nuclear_family_memberships aktif
 *   - Small rooms via parent-child relation (tetap akses setelah menikah)
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const userUuid = auth.userUuid;
  const supabase = initSupabaseServer();

  try {
    // Ambil semua family_uuid yang user bisa akses dari local DB
    const accessRes = await pool.query<{ family_uuid: string }>(
      `-- Jalur A: general rooms via extended group
       SELECT DISTINCT cr.family_uuid::text AS family_uuid
       FROM users u
       JOIN nodes n ON n.user_id = u.id
       JOIN node_extended_groups neg ON neg.node_id = n.id
       JOIN chat_rooms cr ON cr.extended_group_id = neg.extended_group_id
       WHERE u.uuid = $1 AND cr.family_uuid IS NOT NULL

       UNION

       -- Jalur B: small room sebagai kepala keluarga
       SELECT DISTINCT cr.family_uuid::text
       FROM users u
       JOIN nodes n ON n.user_id = u.id
       JOIN chat_rooms cr ON cr.small_family_uuid = n.uuid
                         AND cr.scope_type = 'small'
       WHERE u.uuid = $1 AND cr.family_uuid IS NOT NULL

       UNION

       -- Jalur C: nuclear family aktif
       SELECT DISTINCT nf.uuid::text
       FROM users u
       JOIN nodes n ON n.user_id = u.id
       JOIN nuclear_family_memberships nfm ON nfm.node_id = n.id
       JOIN nuclear_families nf ON nf.id = nfm.nuclear_family_id
       WHERE u.uuid = $1 AND nfm.left_at IS NULL

       UNION

       -- Jalur D: small room via parent-child (akses ke keluarga inti orang tua)
       SELECT DISTINCT cr.family_uuid::text
       FROM users u
       JOIN nodes n ON n.user_id = u.id
       JOIN parent_child_relations pcr ON pcr.child_node_id = n.id
       JOIN nodes parent_node ON parent_node.id = pcr.parent_node_id
       JOIN chat_rooms cr ON cr.small_family_uuid = parent_node.uuid
                         AND cr.scope_type = 'small'
       WHERE u.uuid = $1 AND cr.family_uuid IS NOT NULL`,
      [userUuid],
    );

    const familyUuids = accessRes.rows.map((r) => r.family_uuid);

    if (familyUuids.length === 0) {
      return NextResponse.json({ synced: 0 });
    }

    // Upsert ke Supabase family_members
    // ON CONFLICT DO NOTHING karena UNIQUE(family_uuid, user_id)
    const rows = familyUuids.map((uuid) => ({
      family_uuid: uuid,
      user_id:     userUuid,
      role:        "member",
    }));

    const { error } = await supabase
      .from("family_members")
      .upsert(rows, { onConflict: "family_uuid,user_id", ignoreDuplicates: true });

    if (error) {
      console.error("[sync-family-members] Supabase upsert error:", error);
      return NextResponse.json(
        { error: "Gagal sync family members" },
        { status: 500 },
      );
    }

    return NextResponse.json({ synced: rows.length });

  } catch (err: any) {
    console.error("[sync-family-members] Error:", err);
    return NextResponse.json(
      { error: "Gagal sync family members" },
      { status: 500 },
    );
  }
}
