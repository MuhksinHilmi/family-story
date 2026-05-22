import { NextRequest, NextResponse } from 'next/server';
import { initSupabaseServer } from '@/lib/supabase-server';
import { requireAuth } from '@/lib/auth';
import { getChatRoomById, isUserMemberOfChatRoom } from '@/lib/db_helper/chat';
import pool from '@/lib/db_helper'; // for fetching sender name + local insert

/**
 * 2026 Architecture (Local-First + Realtime Bus)
 *
 * - Local Postgres `messages`  = Permanent source of truth (history + unread)
 * - Supabase `messages`        = Transient realtime delivery bus (H+3 retention)
 *
 * Flow saat kirim pesan:
 *   1. Insert ke local `messages` (aman, langsung tersimpan)
 *   2. Insert ke Supabase (untuk trigger broadcast realtime)
 *   3. Client lain menerima via Realtime Broadcast
 *
 * Keuntungan:
 * - Refresh halaman tidak pernah kehilangan pesan
 * - Supabase boleh hapus data lama setelah 3 hari
 * - Unread tracking & history 100% ada di server DB
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

    // Fetch sender info for snapshot (used in both local and Supabase)
    const userRes = await pool.query(
      'SELECT full_name, photo_url FROM users WHERE uuid = $1',
      [userUuid]
    );
    const senderName = userRes.rows[0]?.full_name || 'Unknown User';
    const senderPhoto = userRes.rows[0]?.photo_url || null;

    const smallFamilyId = chatRoom.small_family_uuid || chatRoom.small_family_id || null;
    const now = new Date().toISOString();

    // 3. Insert FIRST into local Postgres `messages` (permanent source of truth)
    //    This guarantees the message is saved even if Supabase is down or slow.
    const localResult = await pool.query(
      `INSERT INTO messages (
        family_uuid, scope_type, small_family_id,
        sender_id, sender_name_snapshot, sender_photo_snapshot,
        body, type, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, family_uuid, scope_type, small_family_id,
                sender_id, sender_name_snapshot, sender_photo_snapshot,
                body, type, created_at`,
      [
        chatRoom.family_uuid,
        chatRoom.scope_type,
        smallFamilyId,
        userUuid,
        senderName,
        senderPhoto,
        content,
        'text',
        now,
      ]
    );

    const localMessage = localResult.rows[0];

    // 4. Insert into Supabase (only for realtime broadcast + short retention)
    //    If this fails, the message is still safe in local DB.
    try {
      await supabase.from('messages').insert({
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
      // Message already saved locally — we can retry later or let a reconciler job handle it.
      console.warn('[Chat Send] Supabase insert failed (message safe in local DB):', supabaseErr);
    }

    // 5. Return the message from local DB (authoritative)
    return NextResponse.json(localMessage, { status: 201 });
  } catch (error: any) {
    console.error('Chat send error:', error);
    return NextResponse.json({ error: error.message || 'Gagal mengirim pesan' }, { status: 500 });
  }
}