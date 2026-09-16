import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db_helper";
import { requireAuth } from "@/lib/auth";
import { isUserMemberOfChatRoom } from "@/lib/db_helper/chat";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { userId } = auth;
  const roomId = request.nextUrl.pathname.split("/").pop() || "";

  try {
    const hasAccess = await isUserMemberOfChatRoom(userId, roomId);
    if (!hasAccess) {
      return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
    }

    const messagesRes = await pool.query(
      `SELECT id, chat_room_id, sender_id, sender_name_snapshot, body, type, created_at
       FROM messages 
       WHERE chat_room_id = $1 
       ORDER BY created_at ASC`,
      [roomId],
    );

    return NextResponse.json({
      messages: messagesRes.rows.map((row) => ({
        id: row.id,
        chat_room_id: row.chat_room_id,
        sender: row.sender_name_snapshot
          ? { full_name: row.sender_name_snapshot }
          : null,
        content: row.body,
        is_system: row.type === "system",
        created_at: row.created_at,
      })),
    });
  } catch (error) {
    console.error("GET /api/chat/rooms/[id]/messages error:", error);
    return NextResponse.json(
      { error: "Gagal mengambil pesan" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { userId, userUuid } = auth;
  const roomId = request.nextUrl.pathname.split("/").pop() || "";
  const body = await request.json();
  const { content } = body;

  if (!content) {
    return NextResponse.json({ error: "content wajib diisi" }, { status: 400 });
  }

  try {
    const hasAccess = await isUserMemberOfChatRoom(userId, roomId);
    if (!hasAccess) {
      return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
    }

    const userRes = await pool.query(
      "SELECT full_name FROM users WHERE uuid = $1",
      [userUuid],
    );
    const senderName = userRes.rows[0]?.full_name || "Unknown";

    const roomRes = await pool.query(
      "SELECT family_uuid, scope_type, small_family_id FROM chat_rooms WHERE id = $1",
      [roomId],
    );

    const now = new Date().toISOString();

    const result = await pool.query(
      `INSERT INTO messages (
         family_uuid, scope_type, small_family_id, chat_room_id,
         sender_id, sender_name_snapshot, body, type, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'text', $8)
       RETURNING id, chat_room_id, sender_id, sender_name_snapshot, body, created_at`,
      [
        roomRes.rows[0]?.family_uuid,
        roomRes.rows[0]?.scope_type,
        roomRes.rows[0]?.small_family_id,
        roomId,
        userUuid,
        senderName,
        content,
        now,
      ],
    );

    return NextResponse.json(
      {
        message: result.rows[0],
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/chat/rooms/[id]/messages error:", error);
    return NextResponse.json(
      { error: "Gagal mengirim pesan" },
      { status: 500 },
    );
  }
}
