import { NextRequest, NextResponse } from 'next/server';
import { initSupabaseServer } from '@/lib/supabase-server';
import { requireAuth } from '@/lib/auth';
import { getChatRoomById, isUserMemberOfChatRoom } from '@/lib/db_helper/chat';
import pool from '@/lib/db_helper';

/**
 * 2026 Architecture (Local-First + Realtime Bus)
 *
 * - Local Postgres `messages`  = Permanent source of truth (history + unread)
 * - Supabase `messages`        = Transient realtime delivery bus (auto-deleted after 1 day)
 *
 * Flow saat kirim pesan:
 *   1. Insert ke local `messages` (aman, langsung tersimpan)
 *   2. Insert ke Supabase (untuk trigger broadcast realtime)
 *   3. Client lain menerima via Realtime Broadcast
 */

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const supabase = initSupabaseServer();
  const body = await request.json();
  const { room_id, content } = body;

  if (!room_id || !content) {
    return NextResponse.json({ error: 'room_id dan content wajib diisi' }, { status: 400 });
  }

  const userId = auth.userId;
  const userUuid = auth.userUuid;

  try {
    const chatRoom = await getChatRoomById(room_id);

    if (!chatRoom) {
      return NextResponse.json({ error: 'Chat room tidak ditemukan' }, { status: 404 });
    }

    const isMember = await isUserMemberOfChatRoom(userId, room_id);
    if (!isMember) {
      return NextResponse.json({ error: 'Anda bukan anggota keluarga ini' }, { status: 403 });
    }

    const userRes = await pool.query(
      'SELECT full_name, photo_url FROM users WHERE uuid = $1',
      [userUuid]
    );
    const senderName = userRes.rows[0]?.full_name || 'Unknown User';
    const senderPhoto = userRes.rows[0]?.photo_url || null;

    const smallFamilyId = chatRoom.small_family_uuid || chatRoom.small_family_id || null;
    const now = new Date().toISOString();

    const localResult = await pool.query(
      `INSERT INTO messages (
        family_uuid, scope_type, small_family_id, chat_room_id,
        sender_id, sender_name_snapshot, sender_photo_snapshot,
        body, type, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id, family_uuid, scope_type, small_family_id, chat_room_id,
                sender_id, sender_name_snapshot, sender_photo_snapshot,
                body, type, created_at`,
      [
        chatRoom.family_uuid,
        chatRoom.scope_type,
        smallFamilyId,
        room_id,
        userUuid,
        senderName,
        senderPhoto,
        content,
        'text',
        now,
      ]
    );

    const localMessage = localResult.rows[0];

    try {
      await supabase.from('messages').insert({
        room_id: room_id,
        family_uuid: chatRoom.family_uuid,
        scope_type: chatRoom.scope_type,
        small_family_id: smallFamilyId,
        sender_id: userUuid,
        sender_name_snapshot: senderName,
        sender_photo_snapshot: senderPhoto,
        body: content,
        created_at: now,
      });
    } catch (supabaseErr) {
      console.warn('[Chat Send] Supabase insert failed (message safe in local DB):', supabaseErr);
    }

    return NextResponse.json(localMessage, { status: 201 });
  } catch (error: any) {
    console.error('Chat send error:', error);
    return NextResponse.json({ error: error.message || 'Gagal mengirim pesan' }, { status: 500 });
  }
}
