-- db/schema/2026-clean/migrations/010_add_chat_room_id_and_extended_group.sql

-- 010: Add chat_room_id to messages and extended_group_id to chat_rooms
-- This migration is additive and backwards-compatible. It introduces
-- a nullable chat_room_id UUID on the permanent local messages table
-- and a nullable extended_group_id on chat_rooms so we can map
-- extended family -> dedicated chat room.

ALTER TABLE IF EXISTS messages
  ADD COLUMN IF NOT EXISTS chat_room_id UUID REFERENCES chat_rooms(id);

CREATE INDEX IF NOT EXISTS idx_messages_chat_room_id ON messages(chat_room_id);

ALTER TABLE IF EXISTS chat_rooms
  ADD COLUMN IF NOT EXISTS extended_group_id BIGINT REFERENCES extended_family_groups(id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_chat_rooms_ext_group_scope
  ON chat_rooms(extended_group_id, scope_type)
  WHERE extended_group_id IS NOT NULL;

COMMENT ON COLUMN messages.chat_room_id IS 'Optional reference to chat_rooms.id (UUID). Prefer this over family_uuid-based queries.';
COMMENT ON COLUMN chat_rooms.extended_group_id IS 'Reference to extended_family_groups.id to identify a general room per extended group.';
