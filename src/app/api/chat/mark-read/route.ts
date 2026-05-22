import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getChatRoomById, isUserMemberOfChatRoom } from '@/lib/db_helper/chat';
import pool from '@/lib/db_helper';

/**
 * POST /api/chat/mark-read
 *
 * Marks a room as read for the current user.
 * Updates the cursor in user_room_reads so unread_count can be calculated correctly.
 *
 * Body:
 *   {
 *     room_id: string,                    // chat_rooms.id
 *     last_read_message_id?: string       // the newest message.id the user has seen
 *   }
 *
 * Behavior:
 *   - Upserts into user_room_reads
 *   - Sets unread_count = 0 (optimistic)
 *   - Frontend can later refetch /rooms to get fresh counts
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const userId = auth.userId; // integer

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { room_id, last_read_message_id } = body;

  if (!room_id) {
    return NextResponse.json({ error: 'room_id wajib diisi' }, { status: 400 });
  }

  try {
    // Validate room exists
    const room = await getChatRoomById(room_id);
    if (!room) {
      return NextResponse.json({ error: 'Room tidak ditemukan' }, { status: 404 });
    }

    // Validate membership
    const isMember = await isUserMemberOfChatRoom(userId, room_id);
    if (!isMember) {
      return NextResponse.json({ error: 'Anda bukan anggota room ini' }, { status: 403 });
    }

    // Upsert the read cursor
    await pool.query(
      `
      INSERT INTO user_room_reads (user_id, room_id, last_read_message_id, last_read_at, unread_count)
      VALUES ($1, $2, $3, now(), 0)
      ON CONFLICT (user_id, room_id)
      DO UPDATE SET
        last_read_message_id = EXCLUDED.last_read_message_id,
        last_read_at = now(),
        unread_count = 0
      `,
      [userId, room_id, last_read_message_id || null]
    );

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error('[mark-read] Error:', error);
    return NextResponse.json(
      { error: 'Gagal menandai pesan sebagai sudah dibaca' },
      { status: 500 }
    );
  }
}
