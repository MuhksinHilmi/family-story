import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getUserChatRooms } from "@/lib/db_helper/chat";
import pool from "@/lib/db_helper";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const userId = auth.userId;

  try {
    const rooms = await getUserChatRooms(userId);
    const roomIds = rooms.map((r) => r.id);

    if (roomIds.length === 0) {
      return NextResponse.json([], { status: 200 });
    }

    const readsRes = await pool.query(
      `SELECT room_id, last_read_message_id, last_read_at
       FROM user_room_reads
       WHERE user_id = $1 AND room_id = ANY($2::uuid[])`,
      [userId, roomIds]
    );

    const readMap = new Map<string, { lastId: string | null; lastAt: string | null }>();
    for (const row of readsRes.rows) {
      readMap.set(row.room_id, {
        lastId: row.last_read_message_id,
        lastAt: row.last_read_at,
      });
    }

    const formatted = await Promise.all(
      rooms.map(async (room) => {
        const readInfo = readMap.get(room.id);
        let unreadCount = 0;

        if (!readInfo || !readInfo.lastId) {
          const countRes = await pool.query(
            `SELECT COUNT(*)::int as cnt FROM messages 
             WHERE chat_room_id = $1 
               AND (deleted = false OR deleted IS NULL)`,
            [room.id]
          );
          unreadCount = countRes.rows[0]?.cnt || 0;
        } else {
          const countRes = await pool.query(
            `SELECT COUNT(*)::int as cnt FROM messages 
             WHERE chat_room_id = $1 
               AND (deleted = false OR deleted IS NULL)
               AND created_at > $2`,
            [room.id, readInfo.lastAt]
          );
          unreadCount = countRes.rows[0]?.cnt || 0;
        }

        return {
          id: room.id,
          family_uuid: room.family_uuid,
          scope_type: room.scope_type,
          small_family_id: room.small_family_id || null,
          small_family_uuid: room.small_family_uuid || null,
          name: room.name || (room.scope_type === "general" ? "Keluarga Besar" : "Keluarga Inti"),
          unread_count: unreadCount,
        };
      })
    );

    return NextResponse.json(formatted, { status: 200 });
  } catch (error) {
    console.error("GET /api/chat/rooms error:", error);
    return NextResponse.json({ error: "Gagal mengambil daftar room chat" }, { status: 500 });
  }
}
