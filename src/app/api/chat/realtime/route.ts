import { NextRequest, NextResponse } from 'next/server';
import { initSupabaseServer } from '@/lib/supabase-server';
import { getChatRoomById } from '@/lib/db_helper';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const room_id = searchParams.get('room_id');
  const cutoff = searchParams.get('cutoff');
  const limit = parseInt(searchParams.get('limit') || '50', 10);

  if (!room_id) {
    return NextResponse.json({ error: 'room_id diperlukan' }, { status: 400 });
  }

  try {
    // Resolve the logical chat room from local DB (supports both legacy integer id and new UUID id)
    const chatRoom = await getChatRoomById(room_id);
    if (!chatRoom) {
      return NextResponse.json({ error: 'Chat room tidak ditemukan' }, { status: 404 });
    }

    const supabase = initSupabaseServer();
    
    // Query Supabase using the logical room key (family_uuid + scope_type + small_family_id)
    let query = supabase
      .from('messages')
      .select('id, family_uuid, scope_type, small_family_id, sender_id, sender_name_snapshot, sender_photo_snapshot, body, created_at')
      .eq('family_uuid', chatRoom.family_uuid)
      .eq('scope_type', chatRoom.scope_type);

    // small_family_id filter must be conditional:
    // - null for general rooms
    // - actual father_id (as string) for small rooms
    const smallId = chatRoom.small_family_uuid || chatRoom.small_family_id;

    if (smallId == null) {
      query = query.is('small_family_id', null);
    } else {
      query = query.eq('small_family_id', String(smallId));
    }

    query = query.order('created_at', { ascending: true }).limit(limit);
    
    if (cutoff) {
      query = query.gte('created_at', cutoff);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json(data || [], { status: 200 });
  } catch (error: any) {
    console.error('Realtime fetch error:', error);
    return NextResponse.json({ error: error.message || 'Gagal mengambil pesan realtime' }, { status: 500 });
  }
}