// src/lib/db_helper/chat.ts
// Helper functions for chat-related queries against Local Postgres.
// Chat rooms are now primarily identified by `family_uuid` (not integer family_id).
//
// - General room (Keluarga Besar)   → family_uuid
// - Small room (Keluarga Inti)      → family_uuid + small_family_id (father's family_nodes.id)
//
// All membership checks still use the integer `family_id` against `family_members`.
import pool from "./db";

export interface ChatRoom {
  id: string; // internal PK (UUID of the chat_rooms row)
  family_id: number; // legacy integer family id (used only for membership checks)
  family_uuid: string; // stable UUID of the family — primary logical identifier for chat
  scope_type: "general" | "small";
  small_family_id?: number | null; // DEPRECATED (old integer father node id)
  small_family_uuid?: string | null; // UUID of the husband/father (from users.uuid). This is now the main identifier for small rooms.
  name?: string;
}
export async function getChatRoomById(
  roomId: string,
): Promise<ChatRoom | null> {
  const result = await pool.query(
    `SELECT id, family_id, family_uuid, scope_type, small_family_id, small_family_uuid, name 
     FROM chat_rooms 
     WHERE id = $1`,
    [roomId],
  );
  return result.rows[0] || null;
}
export async function isUserMemberOfChatRoom(
  userId: number,
  roomId: string,
): Promise<boolean> {
  const room = await getChatRoomById(roomId);
  if (!room) return false;
  const memberResult = await pool.query(
    `SELECT 1 FROM family_members WHERE user_id = $1 AND family_id = $2`,
    [userId, room.family_id],
  );
  return memberResult.rows.length > 0;
}
/**
 * Get or create General Room for a family.
 * Logical key = family_uuid (scope_type = 'general')
 */
export async function getOrCreateGeneralRoom(
  familyId: number,
  familyUuid: string,
  familyName?: string | null,
): Promise<ChatRoom> {
  const roomName = `Keluarga Besar`;

  const result = await pool.query(
    `INSERT INTO chat_rooms (family_id, family_uuid, scope_type, name, created_at, updated_at)
     VALUES ($1, $2, 'general', $3, NOW(), NOW())
     ON CONFLICT (family_uuid, scope_type, small_family_id)
     DO UPDATE SET
       name = EXCLUDED.name,
       updated_at = NOW()
     RETURNING id, family_id, family_uuid, scope_type, small_family_id, small_family_uuid, name`,
    [familyId, familyUuid, roomName],
  );

  return result.rows[0];
}
/**
 * Get or create Small / Nuclear Family Room for a specific father.
 * Logical key = family_uuid + small_family_id (where small_family_id = father's family_nodes.id)
 * Only direct relatives of the father (wife + children) will have access to this room.
 */
/**
 * Get or create a Small/Nuclear Family room for a specific husband/father.
 * We now store `users.uuid` of the husband (not family_nodes.id) in small_family_uuid.
 * This allows small_family_id in Supabase messages to remain UUID type.
 */
export async function getOrCreateSmallRoom(
  familyId: number,
  familyUuid: string,
  husbandUserUuid: string, // UUID of the husband/father (from users.uuid)
  husbandName?: string, // optional for room name
): Promise<ChatRoom> {
  const roomName = `Keluarga ${husbandName || "Inti"}`;

  const result = await pool.query(
    `INSERT INTO chat_rooms (family_id, family_uuid, scope_type, small_family_uuid, name, created_at, updated_at)
     VALUES ($1, $2, 'small', $3, $4, NOW(), NOW())
     ON CONFLICT (family_uuid, scope_type, small_family_uuid)
     DO UPDATE SET
       name = EXCLUDED.name,
       updated_at = NOW()
     RETURNING id, family_id, family_uuid, scope_type, small_family_id, small_family_uuid, name`,
    [familyId, familyUuid, husbandUserUuid, roomName],
  );

  return result.rows[0];
}
/**
 * Get all chat rooms the user has access to.
 * For each family the user belongs to, we create/ensure:
 *   - 1 General room (identified by family_uuid)
 *   - Small rooms (Keluarga Inti) only for men who have a spouse.
 *     Each small room is identified by family_uuid + husband.users.uuid
 */
export async function getUserChatRooms(userId: number): Promise<ChatRoom[]> {
  // Get all families the user is a member of
  const familiesResult = await pool.query(
    `SELECT DISTINCT fm.family_id, f.uuid as family_uuid, f.name as family_name
     FROM family_members fm
     JOIN families f ON f.id = fm.family_id
     WHERE fm.user_id = $1`,
    [userId],
  );

  const rooms: ChatRoom[] = [];

  for (const fam of familiesResult.rows) {
    const familyId = fam.family_id;
    const familyUuid = fam.family_uuid;
    const familyName = fam.family_name;

    // 1. General room for the whole family (always exists)
    const generalRoom = await getOrCreateGeneralRoom(
      familyId,
      familyUuid,
      familyName,
    );
    rooms.push(generalRoom);

    // 2. Small rooms (Keluarga Inti)
    // Only men who have a spouse (and a linked user account) get their own small family room.
    // We store the husband's users.uuid as small_family_uuid.
    const husbandsResult = await pool.query(
      `
      SELECT DISTINCT fn.id, fn.full_name, u.uuid as husband_uuid
      FROM family_nodes fn
      JOIN users u ON u.id = fn.user_id
      WHERE fn.family_id = $1
        AND fn.gender = 'male'
        AND EXISTS (
          SELECT 1 FROM spouse_relations sr
          WHERE sr.node_a = fn.id OR sr.node_b = fn.id
        )
      `,
      [familyId],
    );

    for (const husband of husbandsResult.rows) {
      const smallRoom = await getOrCreateSmallRoom(
        familyId,
        familyUuid,
        husband.husband_uuid,
        husband.full_name,
      );
      rooms.push(smallRoom);
    }
  }

  return rooms;
}
