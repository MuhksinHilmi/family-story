import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db_helper';
import { requireAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const { searchParams } = new URL(request.url);
    const skillsParam = searchParams.get('skills');

    if (!skillsParam) {
      return NextResponse.json({ error: 'Parameter skills diperlukan' }, { status: 400 });
    }

    const skills = skillsParam.split(',');

    // Query to find nuclear families where either head or spouse has matching skills/occupation
    // We join nuclear_families with nodes to check the profiles
    const query = `
      SELECT
        nf.id as nuclear_family_id,
        nf.name as family_name,
        n1.full_name as head_name,
        n1.occupation as head_occupation,
        n2.full_name as spouse_name,
        n2.occupation as spouse_occupation,
        ARRAY(
          SELECT unnest(n1.skills) UNION
          SELECT unnest(n2.skills)
          WHERE n2.id IS NOT NULL
        ) as combined_skills,
        (SELECT location_label FROM nodes WHERE id = nf.head_node_id) as location_label
      FROM nuclear_families nf
      JOIN nodes n1 ON nf.head_node_id = n1.id
      LEFT JOIN nodes n2 ON nf.spouse_node_id = n2.id
      WHERE
        (n1.occupation_is_public = true OR n2.occupation_is_public = true)
        AND (
          n1.occupation ILIKE ANY(ARRAY[${skills.map(s => `'%${s}%'`).join(',')}])
          OR n2.occupation ILIKE ANY(ARRAY[${skills.map(s => `'%${s}%'`).join(',')}])
          OR n1.skills && ARRAY[${skills.map(s => `'${s}'`).join(', ')}]
          OR n2.skills && ARRAY[${skills.map(s => `'${s}'`).join(', ')}]
        )
        AND nf.id != (SELECT nuclear_family_id FROM nuclear_families WHERE head_node_id = (SELECT id FROM nodes WHERE user_id = $1))
      LIMIT 20;
    `;

    // Note: The above query uses string interpolation for the skills array which is risky.
    // Let's rewrite it using proper parameters.

    const safeQuery = `
      SELECT
        nf.id as nuclear_family_id,
        nf.name as family_name,
        n1.full_name as head_name,
        n1.occupation as head_occupation,
        n2.full_name as spouse_name,
        n2.occupation as spouse_occupation,
        (
          SELECT array_agg(DISTINCT s)
          FROM (
            SELECT unnest(n1.skills) as s
            UNION ALL
            SELECT unnest(n2.skills) as s WHERE n2.id IS NOT NULL
          ) as combined
        ) as combined_skills,
        (SELECT location_label FROM nodes WHERE id = nf.head_node_id) as location_label
      FROM nuclear_families nf
      JOIN nodes n1 ON nf.head_node_id = n1.id
      LEFT JOIN nodes n2 ON nf.spouse_node_id = n2.id
      WHERE
        (n1.occupation_is_public = true OR (n2.id IS NOT NULL AND n2.occupation_is_public = true))
        AND (
          n1.occupation ILIKE ANY($1)
          OR (n2.id IS NOT NULL AND n2.occupation ILIKE ANY($1))
          OR n1.skills && $2
          OR (n2.id IS NOT NULL AND n2.skills && $2)
        )
        AND nf.id != (
          SELECT nuclear_family_id
          FROM nuclear_families
          WHERE head_node_id = (SELECT id FROM nodes WHERE user_id = $3)
        )
      LIMIT 20;
    `;

    const skillPatterns = skills.map(s => `%${s}%`);
    const result = await pool.query(safeQuery, [skillPatterns, skills, auth.userId]);

    return NextResponse.json({
      matches: result.rows.map(row => ({
        ...row,
        matched_skills: row.combined_skills.filter((s: string) =>
          skills.some((target: string) => s.toLowerCase().includes(target.toLowerCase()))
        )
      })),
      has_more: result.rowCount === 20
    });

  } catch (error) {
    console.error('Skill Discovery GET error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan saat mencari keluarga' }, { status: 500 });
  }
}
