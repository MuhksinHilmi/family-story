-- db/scripts/backfill_chat_room_ids.js
// Node script to backfill messages.chat_room_id in batches.
// Strategy:
// 1) For messages that already have chat_room_id set, skip.
// 2) For messages with small_family_id and matching chat_room (small) -> set chat_room_id.
// 3) For messages with family_uuid & extended group mapping -> find chat_room by extended_group_id or family_uuid mapping.
// Run with: node db/scripts/backfill_chat_room_ids.js

const { Client } = require('pg');

async function run() {
  const client = new Client();
  await client.connect();

  const batchSize = 1000;
  let updated = 0;

  while (true) {
    const res = await client.query(
      `SELECT id, family_uuid, scope_type, small_family_id
       FROM messages WHERE chat_room_id IS NULL
       LIMIT $1`,
      [batchSize]
    );

    if (res.rows.length === 0) break;

    for (const row of res.rows) {
      const { id, family_uuid, scope_type, small_family_id } = row;

      // Try small room match first
      let chatRoom = null;

      if (small_family_id) {
        const r = await client.query(
          `SELECT id FROM chat_rooms WHERE small_family_uuid::text = $1::text AND scope_type = $2 LIMIT 1`,
          [String(small_family_id), scope_type]
        );
        chatRoom = r.rows[0];
      }

      // Next try extended_group mapping: if family_uuid maps to a node with extended groups
      if (!chatRoom && family_uuid) {
        // Find chat_room by family_uuid OR by extended group that contains nodes in this family
        const r = await client.query(
          `SELECT id FROM chat_rooms WHERE family_uuid = $1 AND scope_type = $2 LIMIT 1`,
          [family_uuid, scope_type]
        );
        chatRoom = r.rows[0];
      }

      if (chatRoom) {
        await client.query(`UPDATE messages SET chat_room_id = $1 WHERE id = $2`, [chatRoom.id, id]);
        updated++;
      }
    }

    console.log('Processed batch, updated', updated);
    if (res.rows.length < batchSize) break;
  }

  await client.end();
  console.log('Done. Total updated:', updated);
}

run().catch(console.error);
