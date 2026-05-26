import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import pool from '@/lib/db_helper';

// Mark notification as read
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;
  const userId = auth.userId;
  const { id } = await params;

  try {
    await pool.query('UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2', [id, userId]);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('POST /api/notifications/[id]/read error', err);
    return NextResponse.json({ error: 'Gagal menandai notifikasi' }, { status: 500 });
  }
}
