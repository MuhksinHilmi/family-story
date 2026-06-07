import { NextRequest, NextResponse } from 'next/server';
import { initSupabaseServer } from '@/lib/supabase-server';
import { getChatRoomById } from '@/lib/db_helper/chat';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const room_id = searchParams.get('room_id');
  const cutoff = searchParams.get('cutoff');
  const limit = parseInt(searchParams.get('limit') || '50', 10);

  if (!room_id) {
    return NextResponse.json({ error: 'room_id diperlukan' }, { status: 400 });
  }

  try {
    const supabase = initSupabaseServer();

    // Query Supabase using room_id
    let query = supabase
      .from('messages')
      .select(`
        id, room_id, family_uuid, scope_type, small_family_id,
        sender_id, sender_name_snapshot, sender_photo_snapshot,
        body, created_at
      `)
      .eq('room_id', room_id)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (cutoff) {
      query = query.gte('created_at', cutoff);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json(data || [], { status: 200 });
  } catch (error: any) {
    console.error('[Realtime API] Error:', error);
    return NextResponse.json({ error: 'Gagal mengambil pesan dari Supabase' }, { status: 500 });
  }
}
