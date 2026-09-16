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
  id: string;
  family_uuid: string | null;
  scope_type: "general" | "small";
  small_family_id?: number | null; // DEPRECATED — masih ada di DB untuk backward compat
  small_family_uuid?: string | null;
  extended_group_id?: number | null;
  name?: string;
}
export async function getChatRoomById(
  roomId: string,
): Promise<ChatRoom | null> {
  const result = await pool.query(
    `SELECT id, family_uuid, scope_type, small_family_id, small_family_uuid, extended_group_id, name 
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

  // Check room_memberships table first (for taaruf rooms) - TEMPORARILY DISABLED
  // Table not yet created in local DB; will be re-enabled when taaruf is ready
  // const directMembership = await pool.query(
  //   `SELECT 1 FROM room_memberships WHERE chat_room_id = $1 AND user_id = $2`,
  //   [roomId, userId]
  // );
  // if (directMembership.rows.length > 0) return true;

  // For small rooms: check membership in the specific nuclear family
  if (room.small_family_uuid) {
    const memberResult = await pool.query(
      `SELECT 1 FROM nodes n
       WHERE n.user_id = $1 AND n.uuid = $2`,
      [userId, room.small_family_uuid],
    );
    if (memberResult.rows.length > 0) return true;
    // Also check if user is spouse of the husband (anyone in his nuclear family)
    const nuclearFamilyCheck = await pool.query(
      `SELECT 1 
       FROM nuclear_family_memberships nfm
       JOIN nodes n ON n.id = nfm.node_id
       WHERE n.user_id = $1 AND nfm.nuclear_family_id = (
         SELECT n2.current_nuclear_family_id 
         FROM nodes n2 
         WHERE n2.uuid = $2
       )`,
      [userId, room.small_family_uuid],
    );
    return nuclearFamilyCheck.rows.length > 0;
  }

  // For general rooms: check if user has any node in any nuclear family connected to this extended group
  if (room.extended_group_id) {
    const memberResult = await pool.query(
      `SELECT 1 
       FROM nodes n
       JOIN node_extended_groups neg ON neg.node_id = n.id
       WHERE n.user_id = $1 AND neg.extended_group_id = $2`,
      [userId, room.extended_group_id],
    );
    return memberResult.rows.length > 0;
  }

  return false;
}

/**
 * Get or create General Room for a family.
 * Logical key = family_uuid (scope_type = 'general')
 */
export async function getOrCreateGeneralRoom(
  familyId: number | null,
  familyUuid: string,
  familyName?: string | null,
): Promise<ChatRoom> {
  const roomName = `Keluarga Besar`;

  // Use select-then-insert to handle partial unique indexes properly
  const sel = await pool.query(
    `SELECT id, family_uuid, scope_type, small_family_id, small_family_uuid, name
     FROM chat_rooms WHERE family_uuid = $1 AND scope_type = 'general' LIMIT 1`,
    [familyUuid],
  );
  if (sel.rows[0]) {
    return sel.rows[0];
  }

  const result = await pool.query(
    `INSERT INTO chat_rooms (family_uuid, scope_type, name, created_at, updated_at)
     VALUES ($1, 'general', $2, NOW(), NOW())
     RETURNING id, family_uuid, scope_type, small_family_id, small_family_uuid, name`,
    [familyUuid, roomName],
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
 * Signature: (client, familyUuid, husbandUserUuid, husbandName?)
 */
export async function getOrCreateSmallRoom(
  client: any,
  familyUuid: string | null,
  husbandUserUuid: string, // UUID of the husband/father (from users.uuid)
  husbandName?: string | null, // optional for room name
): Promise<ChatRoom | null> {
  const roomName = `Keluarga ${husbandName || "Inti"}`;

  // Use select-then-insert to handle partial unique indexes properly
  const sel = await client.query(
    `SELECT id, family_uuid, scope_type, small_family_id, small_family_uuid, name
     FROM chat_rooms WHERE small_family_uuid = $1 AND scope_type = 'small' LIMIT 1`,
    [husbandUserUuid],
  );
  if (sel.rows[0]) {
    return sel.rows[0];
  }

  const result = await client.query(
    `INSERT INTO chat_rooms (family_uuid, scope_type, small_family_uuid, name, created_at, updated_at)
     VALUES ($1, 'small', $2, $3, NOW(), NOW())
     RETURNING id, family_uuid, scope_type, small_family_id, small_family_uuid, name`,
    [familyUuid, husbandUserUuid, roomName],
  );

  return result.rows[0];
}

/**
 * Get or create a General Room for an extended family group.
 * Creates a room if this extended group doesn't have one yet.
 * Signature: (client, extendedGroupId, familyUuid?, familyName?)
 */
export async function getOrCreateGeneralRoomForExtendedGroup(
  client: any,
  extendedGroupId: number,
  familyUuid?: string | null,
  familyName?: string | null,
): Promise<ChatRoom | null> {
  // Check if room already exists
  const sel = await client.query(
    `SELECT id, family_uuid, scope_type, small_family_id, small_family_uuid, extended_group_id, name
     FROM chat_rooms WHERE extended_group_id = $1 AND scope_type = 'general' LIMIT 1`,
    [extendedGroupId],
  );
  if (sel.rows[0]) {
    return sel.rows[0];
  }

  // Find a representative nuclear family for naming (try to get from nodes in this extended group)
  let repFamilyUuid = familyUuid;

  if (!repFamilyUuid) {
    const repRes = await client.query(
      `SELECT nf.uuid
       FROM node_extended_groups neg
       JOIN nodes n ON n.id = neg.node_id
       LEFT JOIN nuclear_families nf ON nf.id = n.current_nuclear_family_id
       WHERE neg.extended_group_id = $1
       AND n.current_nuclear_family_id IS NOT NULL
       LIMIT 1`,
      [extendedGroupId],
    );
    repFamilyUuid = repRes.rows[0]?.uuid || null;
  }

  const result = await client.query(
    `INSERT INTO chat_rooms (family_uuid, scope_type, extended_group_id, name, created_at, updated_at)
     VALUES ($1, 'general', $2, $3, NOW(), NOW())
     RETURNING id, family_uuid, scope_type, small_family_id, small_family_uuid, extended_group_id, name`,
    [
      repFamilyUuid,
      extendedGroupId,
      familyName || `Keluarga Besar ${extendedGroupId}`,
    ],
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
  // New approach: derive rooms from nodes, extended groups, nuclear families and existing chat_rooms.
  // 1) Get all node ids and uuids for the user
  const nodesRes = await pool.query(
    `SELECT id, uuid, current_nuclear_family_id FROM nodes WHERE user_id = $1`,
    [userId],
  );
  const nodeIds: number[] = nodesRes.rows.map((r: any) => r.id);
  const nodeUuids: string[] = nodesRes.rows.map((r: any) => r.uuid);
  const nuclearFamilyIds: number[] = nodesRes.rows
    .map((r: any) => r.current_nuclear_family_id)
    .filter((v: any) => v != null);

  // 2) Get extended_group_ids for these nodes
  let extendedGroupIds: number[] = [];
  if (nodeIds.length > 0) {
    const egRes = await pool.query(
      `SELECT DISTINCT extended_group_id FROM node_extended_groups WHERE node_id = ANY($1::int[])`,
      [nodeIds],
    );
    extendedGroupIds = egRes.rows.map((r: any) => Number(r.extended_group_id));
  }

  const rooms: ChatRoom[] = [];
  const seenRoomIds = new Set<string>();

  // 3) Find existing chat_rooms that match extended groups, small family uuids, or nuclear_family ids
  const conditions: string[] = [];
  const params: any[] = [];
  let idx = 1;

  // If we have nuclear family ids, fetch their uuids to match chat_rooms.family_uuid
  let nuclearFamilyUuids: string[] = [];
  if (nuclearFamilyIds.length > 0) {
    const nfUres = await pool.query(
      `SELECT uuid FROM nuclear_families WHERE id = ANY($1::int[])`,
      [nuclearFamilyIds],
    );
    nuclearFamilyUuids = nfUres.rows.map((r: any) => r.uuid).filter(Boolean);
  }

  if (extendedGroupIds.length > 0) {
    conditions.push(`extended_group_id = ANY($${idx}::bigint[])`);
    params.push(extendedGroupIds);
    idx++;
  }
  if (nodeUuids.length > 0) {
    conditions.push(`small_family_uuid = ANY($${idx}::uuid[])`);
    params.push(nodeUuids);
    idx++;
  }
  if (nuclearFamilyUuids.length > 0) {
    conditions.push(`family_uuid = ANY($${idx}::uuid[])`);
    params.push(nuclearFamilyUuids);
    idx++;
  }

  if (conditions.length > 0) {
    const q = `SELECT id, family_uuid, scope_type, small_family_id, small_family_uuid, extended_group_id, name FROM chat_rooms WHERE (${conditions.join(" OR ")})`;
    const cr = await pool.query(q, params);
    for (const r of cr.rows) {
      if (!seenRoomIds.has(r.id)) {
        seenRoomIds.add(r.id);
        rooms.push(r);
      }
    }
  }

  // 4) Ensure general rooms exist for any extended group the user belongs to
  for (const egId of extendedGroupIds) {
    const exists = rooms.find(
      (r) => r.extended_group_id === egId && r.scope_type === "general",
    );
    if (!exists) {
      // Try to create a representative room: find one node in the extended group with a current_nuclear_family
      const repRes = await pool.query(
        `SELECT n.id as node_id, n.current_nuclear_family_id FROM node_extended_groups neg JOIN nodes n ON n.id = neg.node_id WHERE neg.extended_group_id = $1 LIMIT 1`,
        [egId],
      );
      const rep = repRes.rows[0];
      let familyUuid = null;
      let familyName = null;
      if (rep && rep.current_nuclear_family_id) {
        const nf = await pool.query(
          `SELECT uuid, name FROM nuclear_families WHERE id = $1 LIMIT 1`,
          [rep.current_nuclear_family_id],
        );
        if (nf.rows[0]) {
          familyUuid = nf.rows[0].uuid;
          familyName = nf.rows[0].name;
        }
      }

      // Insert or get chat_room for this extended group
      // Try select-first then insert to avoid ON CONFLICT issues with partial indexes
      const sel = await pool.query(
        `SELECT id, family_uuid, scope_type, small_family_id, small_family_uuid, extended_group_id, name
          FROM chat_rooms WHERE extended_group_id = $1 AND scope_type = 'general' LIMIT 1`,
        [egId],
      );
      if (sel.rows[0]) {
        if (!seenRoomIds.has(sel.rows[0].id)) {
          seenRoomIds.add(sel.rows[0].id);
          rooms.push(sel.rows[0]);
        }
      } else {
        const ins = await pool.query(
          `INSERT INTO chat_rooms (family_uuid, scope_type, small_family_uuid, extended_group_id, name, created_at, updated_at)
            VALUES ($1, 'general', NULL, $2, $3, NOW(), NOW())
            RETURNING id, family_uuid, scope_type, small_family_id, small_family_uuid, extended_group_id, name`,
          [familyUuid, egId, familyName || "Keluarga " + egId],
        );
        if (!seenRoomIds.has(ins.rows[0].id)) {
          seenRoomIds.add(ins.rows[0].id);
          rooms.push(ins.rows[0]);
        }
      }
    }
  }

  // 5) Small rooms via relasi keluarga — penting untuk akses setelah menikah
  //
  // Aturan: user tetap bisa chat di small room keluarga inti ayahnya
  // meski sudah tidak active member di nuclear family tersebut (sudah menikah).
  // Akses ditentukan oleh relasi parent-child di pohon keluarga, bukan membership aktif.
  //
  // Jalur A: user adalah child dari seorang ayah/ibu yang merupakan head sebuah nuclear family
  //          → user bisa akses small room nuclear family tersebut
  if (nodeIds.length > 0) {
    const parentSmallRoomsRes = await pool.query(
      `SELECT DISTINCT cr.id, cr.family_uuid, cr.scope_type,
              cr.small_family_id, cr.small_family_uuid,
              cr.extended_group_id, cr.name
       FROM parent_child_relations pcr
       JOIN nodes parent_node ON parent_node.id = pcr.parent_node_id
       JOIN nuclear_family_memberships nfm ON nfm.node_id = parent_node.id
                                          AND nfm.role = 'head'
       JOIN nuclear_families nf ON nf.id = nfm.nuclear_family_id
       JOIN chat_rooms cr ON cr.small_family_uuid = parent_node.uuid
                         AND cr.scope_type = 'small'
       WHERE pcr.child_node_id = ANY($1::int[])`,
      [nodeIds],
    );

    for (const r of parentSmallRoomsRes.rows) {
      if (!seenRoomIds.has(r.id)) {
        seenRoomIds.add(r.id);
        rooms.push(r);
      }
    }
  }

  // 5b) Small rooms via nuclear_family aktif (logic lama — untuk anggota aktif)
  if (nuclearFamilyIds.length > 0) {
    for (const nfId of nuclearFamilyIds) {
      // Find husband node user uuid in that nuclear family (head)
      const husRes = await pool.query(
        `SELECT n.id, n.uuid, n.full_name
         FROM nuclear_family_memberships nfm
         JOIN nodes n ON n.id = nfm.node_id
         WHERE nfm.nuclear_family_id = $1 AND nfm.role = 'head' LIMIT 1`,
        [nfId],
      );
      if (husRes.rows[0]) {
        const husbandUuid = husRes.rows[0].uuid;
        const exists = rooms.find(
          (r) =>
            (r.small_family_uuid === husbandUuid ||
              r.small_family_id === husRes.rows[0].id) &&
            r.scope_type === "small",
        );
        if (!exists) {
          // Try select-first then insert to avoid ON CONFLICT issues with partial indexes
          const sel = await pool.query(
            `SELECT id, family_uuid, scope_type, small_family_id, small_family_uuid, extended_group_id, name
             FROM chat_rooms WHERE small_family_uuid = $1 AND scope_type = 'small' LIMIT 1`,
            [husbandUuid],
          );
          if (sel.rows[0]) {
            if (!seenRoomIds.has(sel.rows[0].id)) {
              seenRoomIds.add(sel.rows[0].id);
              rooms.push(sel.rows[0]);
            }
          } else {
            const ins = await pool.query(
              `INSERT INTO chat_rooms (family_uuid, scope_type, small_family_uuid, name, created_at, updated_at)
               VALUES (NULL, 'small', $1, $2, NOW(), NOW())
               RETURNING id, family_uuid, scope_type, small_family_id, small_family_uuid, extended_group_id, name`,
              [husbandUuid, "Keluarga " + (husRes.rows[0].full_name || nfId)],
            );
            if (!seenRoomIds.has(ins.rows[0].id)) {
              seenRoomIds.add(ins.rows[0].id);
              rooms.push(ins.rows[0]);
            }
          }
        }
      }
    }
  }

  return rooms;
}
