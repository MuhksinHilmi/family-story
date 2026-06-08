import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db_helper';
import { requireAuth } from '@/lib/auth';
import { randomUUID } from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const body = await request.json();
    const { target_nuclear_family_id, theme, skills } = body;

    if (!target_nuclear_family_id) {
      return NextResponse.json({ error: 'Target keluarga diperlukan' }, { status: 400 });
    }

    // 1. Verify target family exists
    const familyCheck = await pool.query('SELECT id FROM nuclear_families WHERE id = $1', [target_nuclear_family_id]);
    if (familyCheck.rowCount === 0) {
      return NextResponse.json({ error: 'Keluarga target tidak ditemukan' }, { status: 404 });
    }

    // 2. Get sender node id
    const nodeRes = await pool.query('SELECT id FROM nodes WHERE user_id = $1', [auth.userId]);
    const senderNodeId = nodeRes.rows[0]?.id;

    // 3. Check for existing pending invitation
    const inviteCheck = await pool.query(
      'SELECT id FROM halaqah_invites WHERE sender_node_id = $1 AND target_nuclear_family_id = $2 AND status = \'pending\'',
      [senderNodeId, target_nuclear_family_id]
    );
    if (inviteCheck.rowCount > 0) {
      return NextResponse.json({ error: 'Undangan masih tertunda (pending)' }, { status: 400 });
    }

    // 4. Create invitation
    await pool.query(
      `INSERT INTO halaqah_invites (sender_node_id, target_nuclear_family_id, theme, suggested_skills, status)
       VALUES ($1, $2, $3, $4, 'pending')`,
      [senderNodeId, target_nuclear_family_id, theme, skills]
    );

    return NextResponse.json({ message: 'Undangan belajar berhasil dikirim' });
  } catch (error) {
    console.error('Send Invitation error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan saat mengirim undangan' }, { status: 500 });
  }
}
