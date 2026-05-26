import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db_helper';
import { getChatRoomById } from '@/lib/db_helper/chat';

/**
 * GET /api/chat/archive
 * Returns historical messages from the permanent local `messages` table.
 *
 * Query params:
 *   - room_id: chat_rooms.id (UUID)
 *   - limit, before (created_at cursor for pagination)
 *
 * This endpoint replaced the old chat_message_archive queries (2026 cleanup).
 * It resolves the logical room key (family_uuid + scope_type + small_family_id)
 * and queries the clean `messages` table.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const roomId = searchParams.get('room_id');
  const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 200);
  const before = searchParams.get('before');
  const latest = searchParams.get('latest') === 'true'; // new: get the most recent N messages

  if (!roomId) {
    return NextResponse.json({ error: 'room_id diperlukan' }, { status: 400 });
  }

  try {
    // Resolve the logical room key from chat_rooms (family_uuid + scope_type + small_family_id)
  const room = await getChatRoomById(roomId);
    if (!room) {
      return NextResponse.json({ error: 'Chat room tidak ditemukan' }, { status: 404 });
    }

    // Prefer querying by chat_room_id when available
    const params: any[] = [roomId];
    let query = `
      SELECT 
        id,
        family_uuid,
        scope_type,
        small_family_id,
        chat_room_id,
        sender_id,
        sender_name_snapshot,
        sender_photo_snapshot,
        body,
        type,
        created_at,
        deleted
      FROM messages
      WHERE chat_room_id = $1
        AND (deleted = false OR deleted IS NULL)
    `;

    // If latest flag, order desc limit; else asc pagination (before)


    if (before) {
      query += ` AND created_at < $2`;
      params.push(before);
    }

    if (latest) {
      // Return the most recent messages (for initial load after refresh)
      query += ` ORDER BY created_at DESC LIMIT $3`;
      params.push(limit);
    } else {
      query += ` ORDER BY created_at ASC LIMIT $3 OFFSET $4`;
      params.push(limit, 0);
    }

    const result = await pool.query(query, params);

    return NextResponse.json(result.rows, { status: 200 });
  } catch (error) {
    console.error('[Archive] Error:', error);
    return NextResponse.json({ error: 'Gagal mengambil pesan' }, { status: 500 });
  }
}