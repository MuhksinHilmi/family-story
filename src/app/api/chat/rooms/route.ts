import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getUserChatRooms } from "@/lib/db_helper/chat";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const userId = auth.userId; // already resolved to integer local ID by requireAuth

  try {
    const rooms = await getUserChatRooms(userId);

    // Format for frontend
    const formatted = rooms.map((room) => ({
      id: room.id,
      family_uuid: room.family_uuid,
      scope_type: room.scope_type,
      small_family_id: room.small_family_id || null,
      small_family_uuid: room.small_family_uuid || null,
      name:
        room.name ||
        (room.scope_type === "general" ? "Keluarga Besar" : "Keluarga Inti"),
    }));

    return NextResponse.json(formatted, { status: 200 });
  } catch (error) {
    console.error("GET /api/chat/rooms error:", error);
    return NextResponse.json(
      { error: "Gagal mengambil daftar room chat" },
      { status: 500 },
    );
  }
}
