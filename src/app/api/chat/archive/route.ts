import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db_helper';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const room_id = searchParams.get('room_id');
  const limit = parseInt(searchParams.get('limit') || '50', 10);
  const offset = parseInt(searchParams.get('offset') || '0', 10);
  const before = searchParams.get('before');

  if (!room_id) {
    return NextResponse.json({ error: 'room_id diperlukan' }, { status: 400 });
  }

  try {
    let query = `SELECT id, room_id, chat_room_id, user_id, content, type, created_at, edited_at, deleted, metadata
       FROM chat_message_archive 
       WHERE (room_id = $1 OR chat_room_id::text = $1) AND deleted = false`;
    
    const params: any[] = [room_id];
    
    if (before) {
      query += ` AND created_at < $${params.length + 1}`;
      params.push(before);
    }
    
    query += ` ORDER BY created_at ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    return NextResponse.json(result.rows, { status: 200 });
  } catch (error) {
    console.error('Archive fetch error:', error);
    return NextResponse.json({ error: 'Gagal mengambil pesan archive' }, { status: 500 });
  }
}