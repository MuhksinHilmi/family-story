-- db/schema/2026-clean/migrations/012_create_user_room_reads.sql
-- Create user_room_reads table for per-user read tracking (unread badges)

CREATE TABLE IF NOT EXISTS user_room_reads (
  user_id               INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  room_id               UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  last_read_message_id  UUID,
  last_read_at          TIMESTAMPTZ DEFAULT now(),
  unread_count          INTEGER DEFAULT 0,
  PRIMARY KEY (user_id, room_id)
);

CREATE INDEX IF NOT EXISTS idx_user_room_reads_room ON user_room_reads (room_id);
CREATE INDEX IF NOT EXISTS idx_user_room_reads_user ON user_room_reads (user_id);

COMMENT ON TABLE user_room_reads IS 'Tracks the last message each user has read per chat room. Enables per-user unread count and badges.';
COMMENT ON COLUMN user_room_reads.last_read_message_id IS 'Points to messages.id for calculating unread messages.';