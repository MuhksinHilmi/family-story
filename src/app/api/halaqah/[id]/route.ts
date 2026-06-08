import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db_helper';
import { requireAuth } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const halaqahId = params.id;

    // 1. Fetch Halaqah Detail
    const hRes = await pool.query(
      'SELECT * FROM halaqahs WHERE id = $1',
      [halaqahId]
    );
    const halaqah = hRes.rows[0];

    if (!halaqah) {
      return NextResponse.json({ error: 'Halaqah tidak ditemukan' }, { status: 404 });
    }

    // 2. Fetch Members
    const mRes = await pool.query(
      `SELECT hm.id, hm.status, hm.is_admin, n.full_name, n.occupation, nf.name as family_name
       FROM halaqah_members hm
       JOIN nodes n ON hm.node_id = n.id
       JOIN nuclear_families nf ON nf.id = n.current_nuclear_family_id
       WHERE hm.halaqah_id = $1`,
      [halaqahId]
    );

    // 3. Fetch Learning Path & Steps
    let learningPath = null;
    let steps = [];
    let progress = [];

    if (halaqah.learning_path_id) {
      const pathRes = await pool.query(
        'SELECT * FROM learning_paths WHERE id = $1',
        [halaqah.learning_path_id]
      );
      learningPath = pathRes.rows[0];

      const stepsRes = await pool.query(
        'SELECT * FROM learning_steps WHERE path_id = $1 ORDER BY step_order ASC',
        [halaqah.learning_path_id]
      );
      steps = stepsRes.rows;

      const progRes = await pool.query(
        'SELECT step_id, nuclear_family_id, is_completed FROM halaqah_step_progress WHERE halaqah_id = $1',
        [halaqahId]
      );
      progress = progRes.rows;
    }

    return NextResponse.json({
      halaqah,
      members: mRes.rows,
      learningPath,
      steps,
      progress,
    });
  } catch (error) {
    console.error('Halaqah Detail GET error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const halaqahId = params.id;
    const body = await request.json();
    const { name, description, learning_path_id } = body;

    const updateFields = [];
    const values: any[] = [];
    let idx = 1;

    if (name) { updateFields.push(`name = $${idx++}`); values.push(name); }
    if (description) { updateFields.push(`description = $${idx++}`); values.push(description); }
    if (learning_path_id) { updateFields.push(`learning_path_id = $${idx++}`); values.push(learning_path_id); }

    if (updateFields.length === 0) return NextResponse.json({ message: 'No changes' });

    values.push(halaqahId);
    await pool.query(`UPDATE halaqahs SET ${updateFields.join(', ')} WHERE id = $${idx}`, values);

    return NextResponse.json({ message: 'Halaqah updated successfully' });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
