import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import pool from "@/lib/db_helper";

/**
 * GET /api/user/families
 * Returns all families that the authenticated user belongs to.
 * This endpoint is reusable across the app (feeds, chat, settings, etc.)
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const userId = auth.userId;

  try {
    const result = await pool.query(
      `
      SELECT 
        f.id,
        f.uuid,
        f.name,
        fm.role,
        fm.joined_at
      FROM family_members fm
      JOIN families f ON f.id = fm.family_id
      WHERE fm.user_id = $1
      ORDER BY fm.joined_at DESC
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
