import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db_helper';
import { requireAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const userId = auth.userId;

    // 1. Fetch professional data from nodes table
    const nodeResult = await pool.query(
      'SELECT occupation, skills, occupation_is_public FROM nodes WHERE user_id = $1',
      [userId]
    );
    const nodeData = nodeResult.rows[0] || { occupation: '', skills: [], occupation_is_public: true };

    // 2. Fetch experience from node_experiences table
    const expResult = await pool.query(
      'SELECT id, company_name, role, start_date, end_date, description, is_public FROM node_experiences WHERE node_id = (SELECT id FROM nodes WHERE user_id = $1) ORDER BY start_date DESC',
      [userId]
    );
    const experiences = expResult.rows;

    return NextResponse.json({
      professional: {
        ...nodeData,
        experiences,
      },
    });
  } catch (error) {
    console.error('Professional Profile GET error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan saat mengambil data profil profesional' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const userId = auth.userId;
    const body = await request.json();

    const {
      occupation,
      skills,
      occupation_is_public,
      experiences
    } = body;

    // Start transaction
    await pool.query('BEGIN');

    try {
      // 1. Update nodes table
      const updateFields = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (occupation !== undefined) {
        updateFields.push(`occupation = $${paramIndex++}`);
        values.push(occupation);
      }
      if (skills !== undefined) {
        updateFields.push(`skills = $${paramIndex++}`);
        values.push(skills);
      }
      if (occupation_is_public !== undefined) {
        updateFields.push(`occupation_is_public = $${paramIndex++}`);
        values.push(occupation_is_public);
      }

      if (updateFields.length > 0) {
        values.push(userId);
        await pool.query(
          `UPDATE nodes SET ${updateFields.join(', ')} WHERE user_id = $${paramIndex}`,
          values
        );
      }

      // 2. Update experiences (Simple Replace Strategy)
      if (experiences !== undefined) {
        // Delete all existing experiences for this user
        await pool.query(
          'DELETE FROM node_experiences WHERE node_id = (SELECT id FROM nodes WHERE user_id = $1)',
          [userId]
        );

        // Insert new ones
        for (const exp of experiences) {
          await pool.query(
            `INSERT INTO node_experiences
            (node_id, company_name, role, start_date, end_date, description, is_public)
            VALUES ((SELECT id FROM nodes WHERE user_id = $1), $2, $3, $4, $5, $6, $7)`,
            [userId, exp.company_name, exp.role, exp.start_date, exp.end_date, exp.description, exp.is_public ?? true]
          );
        }
      }

      await pool.query('COMMIT');
      return NextResponse.json({ message: 'Profil profesional berhasil diperbarui' });
    } catch (innerError) {
      await pool.query('ROLLBACK');
      throw innerError;
    }
  } catch (error) {
    console.error('Professional Profile PUT error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan saat memperbarui profil profesional' }, { status: 500 });
  }
}
