import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db_helper';
import { requireAuth } from '@/lib/auth';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const halaqahId = params.id;
    const body = await request.json();
    const { step_id, nuclear_family_id, is_completed } = body;

    if (!step_id || !nuclear_family_id) {
      return NextResponse.json({ error: 'step_id dan nuclear_family_id diperlukan' }, { status: 400 });
    }

    await pool.query(
      `INSERT INTO halaqah_step_progress (halaqah_id, step_id, nuclear_family_id, is_completed)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (halaqah_id, step_id, nuclear_family_id)
       DO UPDATE SET is_completed = EXCLUDED.is_completed, completed_at = NOW()`,
      [halaqahId, step_id, nuclear_family_id, is_completed]
    );

    return NextResponse.json({ message: 'Progress berhasil diperbarui' });
  } catch (error) {
    console.error('Update Progress error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
