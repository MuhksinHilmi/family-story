import { NextResponse } from "next/server";
import pool from "@/lib/db_helper";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await pool.query(
      `
      SELECT
        (
          SELECT COUNT(*)::int
          FROM nuclear_families
          WHERE status = 'active'
        ) AS registered_families,
        (
          SELECT COUNT(DISTINCT nfm.node_id)::int
          FROM nuclear_family_memberships nfm
          WHERE nfm.is_active = true
        ) AS connected_members,
        (
          SELECT COUNT(*)::int
          FROM marriages
          WHERE status = 'married'
        ) AS married_couples
      `,
    );

    const row = result.rows[0] ?? {};

    return NextResponse.json({
      registeredFamilies: Number(row.registered_families ?? 0),
      connectedMembers: Number(row.connected_members ?? 0),
      marriedCouples: Number(row.married_couples ?? 0),
    });
  } catch (error) {
    console.error("Landing stats error:", error);
    return NextResponse.json(
      { error: "Gagal mengambil statistik" },
      { status: 500 },
    );
  }
}
