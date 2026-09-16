import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db_helper";
import { requireAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const { searchParams } = new URL(request.url);
    const skillsParam = searchParams.get("skills");

    if (!skillsParam) {
      return NextResponse.json(
        { error: "Parameter skills diperlukan" },
        { status: 400 },
      );
    }

    const skills = skillsParam.split(",").filter(Boolean);

    // Cari nuclear families yang head/spouse-nya punya occupation atau skills yang cocok.
    // Schema 2026-clean: head/spouse diambil dari nuclear_family_memberships (role = 'head'/'spouse')
    // bukan dari kolom head_node_id/spouse_node_id di nuclear_families.
    const safeQuery = `
      SELECT
        nf.id          AS nuclear_family_id,
        nf.name        AS family_name,
        n1.full_name   AS head_name,
        n1.occupation  AS head_occupation,
        n2.full_name   AS spouse_name,
        n2.occupation  AS spouse_occupation,
        (
          SELECT array_agg(DISTINCT s)
          FROM (
            SELECT unnest(n1.skills) AS s
            UNION ALL
            SELECT unnest(n2.skills) AS s WHERE n2.id IS NOT NULL
          ) AS combined
        ) AS combined_skills
      FROM nuclear_families nf
      -- Head
      JOIN nuclear_family_memberships nfm1 ON nfm1.nuclear_family_id = nf.id
                                           AND nfm1.role = 'head'
                                           AND nfm1.left_at IS NULL
      JOIN nodes n1 ON n1.id = nfm1.node_id
      -- Spouse (optional)
      LEFT JOIN nuclear_family_memberships nfm2 ON nfm2.nuclear_family_id = nf.id
                                                AND nfm2.role = 'spouse'
                                                AND nfm2.left_at IS NULL
      LEFT JOIN nodes n2 ON n2.id = nfm2.node_id
      WHERE
        (n1.occupation_is_public = true OR (n2.id IS NOT NULL AND n2.occupation_is_public = true))
        AND (
          n1.occupation ILIKE ANY($1)
          OR (n2.id IS NOT NULL AND n2.occupation ILIKE ANY($1))
          OR (n1.skills IS NOT NULL AND n1.skills && $2)
          OR (n2.id IS NOT NULL AND n2.skills IS NOT NULL AND n2.skills && $2)
        )
        AND nf.id != $3
      LIMIT 20
    `;

    const skillPatterns = skills.map((s) => `%${s}%`);
    const myFamilyId = auth.nuclearFamilyId ?? -1;

    const result = await pool.query(safeQuery, [
      skillPatterns,
      skills,
      myFamilyId,
    ]);

    return NextResponse.json({
      matches: result.rows.map((row) => ({
        ...row,
        combined_skills: row.combined_skills || [],
        matched_skills: (row.combined_skills || []).filter((s: string) =>
          skills.some((target: string) =>
            s.toLowerCase().includes(target.toLowerCase()),
          ),
        ),
      })),
      has_more: (result.rowCount ?? 0) === 20,
    });
  } catch (error) {
    console.error("Skill Discovery GET error:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan saat mencari keluarga" },
      { status: 500 },
    );
  }
}
