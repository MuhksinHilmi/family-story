import { NextRequest, NextResponse } from 'next/server';
import { initSupabaseServer } from '@/lib/supabase-server';
import { requireAuth } from '@/lib/auth';
import { getChatRoomById, isUserMemberOfChatRoom } from '@/lib/db_helper';
import pool from '@/lib/db_helper';  // for fetching sender name

/**
 * Long-term Architecture (Opsi 1):
 * - chat_rooms & family_members → Local Postgres (source of truth)
 * - messages table → Supabase (only for Realtime Broadcast + short retention)
 *
 * This route resolves room/family from Local DB, then only uses Supabase
 * to insert the actual chat message.
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

  const userId = auth.userId;      // integer local user ID (from requireAuth lookup)
  const userUuid = auth.userUuid;  // UUID (for Supabase sender_id)

  try {
    // 1. Resolve the logical chat room from local DB (source of truth)
    const chatRoom = await getChatRoomById(room_id);

    if (!chatRoom) {
      return NextResponse.json({ error: 'Chat room tidak ditemukan' }, { status: 404 });
    }

    // 2. Verify membership against local database
    const isMember = await isUserMemberOfChatRoom(userId, room_id);
    if (!isMember) {
      return NextResponse.json({ error: 'Anda bukan anggota keluarga ini' }, { status: 403 });
    }

    // Fetch sender info for snapshot
    const userRes = await pool.query(
      'SELECT full_name, photo_url FROM users WHERE uuid = $1',
      [userUuid]
    );
    const senderName = userRes.rows[0]?.full_name || 'Unknown User';
    const senderPhoto = userRes.rows[0]?.photo_url || null;

    // 3. Insert into Supabase messages (only for realtime + short retention)
    const { data, error } = await supabase
      .from('messages')
      .insert({
        family_uuid: chatRoom.family_uuid,
        scope_type: chatRoom.scope_type,
        small_family_id: chatRoom.small_family_uuid || 
                         (chatRoom.small_family_id ? String(chatRoom.small_family_id) : null),
        sender_id: userUuid,
        sender_name_snapshot: senderName,
        sender_photo_snapshot: senderPhoto,
        body: content,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    console.error('Chat send error:', error);
    return NextResponse.json({ error: error.message || 'Gagal mengirim pesan' }, { status: 500 });
  }
}