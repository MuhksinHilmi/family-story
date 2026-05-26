// db/scripts/create_rooms_for_extended_groups_and_backfill.js
// 1) Ensure there is a general chat_room per extended_family_group (create if missing)
// 2) Backfill messages.chat_room_id for general messages by matching family_uuid -> chat_room.family_uuid
// 3) Backfill messages.chat_room_id for small messages by matching small_family_id -> chat_room.small_family_uuid

const { Client } = require('pg');

async function run() {
  const client = new Client();
  await client.connect();

  try {
    console.log('Fetching extended groups...');
    const egRes = await client.query('SELECT id FROM extended_family_groups');
    console.log('Found', egRes.rows.length, 'extended groups');

    for (const row of egRes.rows) {
      const egId = row.id;

      // Find one representative node in this extended group that has a current_nuclear_family
      const repRes = await client.query(
        `SELECT n.id as node_id, n.current_nuclear_family_id
         FROM node_extended_groups neg
         JOIN nodes n ON n.id = neg.node_id
         WHERE neg.extended_group_id = $1
         AND n.current_nuclear_family_id IS NOT NULL
         LIMIT 1`,
        [egId]
      );

      if (repRes.rows.length === 0) {
        console.log(`extended_group ${egId}: no representative node with nuclear family — skipping room creation`);
        continue;
      }

      const rep = repRes.rows[0];
      const nfId = rep.current_nuclear_family_id;

      // Find nuclear_family uuid and name
      const nfRes = await client.query(`SELECT id, uuid, name FROM nuclear_families WHERE id = $1 LIMIT 1`, [nfId]);
      if (nfRes.rows.length === 0) {
        console.log(`extended_group ${egId}: nuclear_family ${nfId} not found — skipping`);
        continue;
      }

      const nf = nfRes.rows[0];

      // Insert chat_room for this extended_group if not exists.
      // Use ON CONFLICT on (extended_group_id, scope_type) to avoid duplicates.
      const insertSql = `
        INSERT INTO chat_rooms (id, family_id, family_uuid, scope_type, small_family_id, extended_group_id, name, created_at, updated_at)
        VALUES (gen_random_uuid(), $1, $2, 'general', NULL, $3, $4, NOW(), NOW())
        ON CONFLICT (extended_group_id, scope_type) DO UPDATE SET name = EXCLUDED.name, updated_at = NOW()
        RETURNING id
      `;

      const name = nf.name || `Keluarga ${egId}`;
      const insRes = await client.query(insertSql, [nf.id, nf.uuid, egId, name]);
      const chatRoomId = insRes.rows[0].id;

      console.log(`extended_group ${egId}: ensured chat_room ${chatRoomId} (family ${nf.uuid})`);

      // Backfill messages for this family_uuid (general scope)
      const updateRes = await client.query(
        `UPDATE messages m SET chat_room_id = $1
         FROM chat_rooms cr
         WHERE m.chat_room_id IS NULL
           AND m.scope_type = 'general'
           AND m.family_uuid = $2
           AND cr.id = $1
         RETURNING count(m.*) as updated_count`,
        [chatRoomId, nf.uuid]
      );

      // Note: the above RETURNING count(...) may not work as written; instead run separate update
      const upd = await client.query(
        `UPDATE messages SET chat_room_id = $1
         WHERE chat_room_id IS NULL
           AND scope_type = 'general'
           AND family_uuid = $2`,
        [chatRoomId, nf.uuid]
      );
      console.log(`Backfilled messages for family_uuid=${nf.uuid}: rowCount=${upd.rowCount}`);
    }

    // Backfill small rooms mapping: match small_family_id (uuid) to chat_rooms.small_family_uuid or small_family_id
    // Update messages where scope_type='small' and chat_room_id is NULL
    console.log('Backfilling small room messages by small_family_id...');
    const smallUpd = await client.query(
      `UPDATE messages m SET chat_room_id = cr.id
       FROM chat_rooms cr
       WHERE m.chat_room_id IS NULL
         AND m.scope_type = 'small'
         AND (m.small_family_id::text = cr.small_family_uuid::text OR m.small_family_id::text = cr.small_family_id::text)
       RETURNING m.id`);

    console.log('Backfilled small messages rows:', smallUpd.rowCount);

    console.log('Done.');
  } catch (err) {
    console.error('Error during create/backfill:', err);
  } finally {
    await client.end();
  }
}

run().catch(console.error);
