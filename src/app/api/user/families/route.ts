import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import pool from "@/lib/db_helper";

/**
 * GET /api/user/families
 * Returns all nuclear families that the authenticated user belongs to.
 * Uses new 2026 schema (nuclear_families + nuclear_family_memberships)
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const userId = auth.userId;

  try {
    const result = await pool.query(
      `
      SELECT 
        nf.id,
        nf.uuid,
        nf.name,
        nfm.role,
        nfm.joined_at
      FROM nuclear_family_memberships nfm
      JOIN nuclear_families nf ON nf.id = nfm.nuclear_family_id
      JOIN nodes n ON n.id = nfm.node_id
      WHERE n.user_id = $1
      ORDER BY nfm.joined_at DESC
      `,
      [userId]
    );

    const families = result.rows.map((row: any) => ({
      id: row.id,
      uuid: row.uuid,
      name: row.name,
      role: row.role || "member",
      joined_at: row.joined_at,
    }));

    return NextResponse.json(families, { status: 200 });
  } catch (error) {
    console.error("GET /api/user/families error:", error);
    return NextResponse.json(
      { error: "Gagal mengambil daftar keluarga" },
      { status: 500 }
    );
  }
}
