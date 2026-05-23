-- Migration 010: Cleanup chat schema - Remove legacy room_id references + Create clean messages + user_room_reads tables
--
-- PURPOSE:
--   - Remove all historical references to `room_id` / `chat_room_id` from chat system
--   - Establish final, clean schema that matches current Supabase `messages` table (2026)
--   - Add per-user read tracking (`user_room_reads`) so unread badge count is possible per user
--
-- DESIGN DECISION (Important for future developers):
--   - One `messages` table in local Postgres is NOT enough for unread tracking.
--   - We need a separate `user_room_reads` table (cursor per user per room).
--   - Supabase `messages` remains transient (H+3 retention) for realtime only.
--   - Local `messages` + `user_room_reads` become the permanent, authoritative source.
--
-- Room identification (no more room_id column):
--   General room: family_uuid + scope_type = 'general'
--   Small room  : family_uuid + scope_type = 'small' + small_family_id (users.uuid of husband/father)
--
-- small_family_id is already UUID (users.uuid) since migration 009.

-- =============================================================================
-- 1. Create clean `messages` table (authoritative permanent store in local DB)
-- =============================================================================
CREATE TABLE IF NOT EXISTS messages (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_uuid             UUID NOT NULL REFERENCES families(uuid) ON DELETE CASCADE,
  scope_type              TEXT NOT NULL CHECK (scope_type IN ('general', 'small')),
  small_family_id         UUID,                    -- users.uuid of husband/father (nullable for general)
  sender_id               UUID NOT NULL,
  sender_name_snapshot    TEXT,
  sender_photo_snapshot   TEXT,
  body                    TEXT NOT NULL,
  type                    TEXT DEFAULT 'text',     -- 'text' | 'image' | 'video' | 'file' (future)
  media_url               TEXT,
  media_mime_type         TEXT,
  media_size_bytes        BIGINT,
  thumbnail_url           TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted                 BOOLEAN DEFAULT false
);

-- Best indexes for chat usage patterns
CREATE INDEX IF NOT EXISTS idx_messages_family_created
  ON messages (family_uuid, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_room_created
  ON messages (family_uuid, scope_type, small_family_id, created_at DESC);

COMMENT ON TABLE messages IS 'Permanent authoritative chat messages (local Postgres). Survives Supabase H+3 deletion. Source of truth for history and unread calculation.';
COMMENT ON COLUMN messages.small_family_id IS 'users.uuid of the husband/father (only for scope_type=small). Matches Supabase messages.small_family_id.';

-- =============================================================================
-- 2. Create `user_room_reads` - Per-user read cursor (required for unread badges)
-- =============================================================================
CREATE TABLE IF NOT EXISTS user_room_reads (
  user_id               INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  room_id               UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  last_read_message_id  UUID,                    -- the newest message.id the user has seen in this room
  last_read_at          TIMESTAMPTZ DEFAULT now(),
  unread_count          INTEGER DEFAULT 0,       -- can be maintained via trigger or calculated on-the-fly
  PRIMARY KEY (user_id, room_id)
);

CREATE INDEX IF NOT EXISTS idx_user_room_reads_room ON user_room_reads (room_id);
CREATE INDEX IF NOT EXISTS idx_user_room_reads_user ON user_room_reads (user_id);

COMMENT ON TABLE user_room_reads IS 'Tracks the last message each user has read per chat room. Enables per-user unread count and badges. New family members get a row with NULL last_read_message_id (everything is unread).';
COMMENT ON COLUMN user_room_reads.last_read_message_id IS 'Points to messages.id. When user opens room and scrolls to bottom, this is updated. Unread count = number of messages with id > last_read_message_id (or created_at > last_read_at) in that room.';

-- =============================================================================
-- 3. Legacy cleanup on chat_message_archive (keep for very old history, mark as deprecated)
-- =============================================================================
-- We do NOT drop the table yet (may contain historical data).
-- We only add comments and (optionally) make room_id columns nullable / deprecated.

ALTER TABLE chat_message_archive
  ALTER COLUMN room_id DROP NOT NULL;  -- was TEXT legacy

ALTER TABLE chat_message_archive
  ALTER COLUMN chat_room_id DROP NOT NULL;

COMMENT ON TABLE chat_message_archive IS
  'LEGACY / DEPRECATED (2026 cleanup). Old daily backup table. Do not use for new messages. Use the new `messages` table instead. This table may be archived or dropped after full migration of historical data.';

COMMENT ON COLUMN chat_message_archive.room_id IS
  'LEGACY - old text identifier. No longer populated. Use family_uuid + scope_type + small_family_id from the new messages table.';

COMMENT ON COLUMN chat_message_archive.chat_room_id IS
  'LEGACY - old UUID reference. No longer populated after 2026 cleanup.';

-- =============================================================================
-- 4. Cleanup comments on chat_rooms (remove old small_family_id references)
-- =============================================================================
COMMENT ON COLUMN chat_rooms.small_family_id IS
  'DEPRECATED (integer). Use small_family_uuid (users.uuid of husband) instead. Kept only for backward compatibility during transition.';

COMMENT ON COLUMN chat_rooms.small_family_uuid IS
  'Current identifier: users.uuid of the husband/father. Combined with family_uuid + scope_type identifies a nuclear family chat room (Keluarga Inti).';

-- =============================================================================
-- 5. Ensure chat_rooms has proper comment about logical key (no room_id anywhere)
-- =============================================================================
COMMENT ON TABLE chat_rooms IS
  'Chat rooms identified by composite key (family_uuid + scope_type + small_family_uuid). No integer room_id is used anymore. General = family_uuid only. Small = family_uuid + husband users.uuid.';

-- =============================================================================
-- 6. (Optional safety) Create a helper view for unread counts (can be used by APIs)
-- =============================================================================
CREATE OR REPLACE VIEW v_room_unread_counts AS
SELECT
  urr.user_id,
  urr.room_id,
  cr.family_uuid,
  cr.scope_type,
  cr.small_family_uuid,
  urr.last_read_message_id,
  urr.last_read_at,
  COALESCE(urr.unread_count, 0) AS unread_count
FROM user_room_reads urr
JOIN chat_rooms cr ON cr.id = urr.room_id;

COMMENT ON VIEW v_room_unread_counts IS
  'Convenience view for APIs to quickly get unread counts per user per room. In production you may replace the unread_count column with a trigger that maintains it automatically.';

-- =============================================================================
-- End of Migration 010
-- =============================================================================
-- After running this migration:
--   1. New messages should be written to the `messages` table (local) + Supabase.
--   2. All new chat code must use family_uuid + scope_type + small_family_id (no room_id).
--   3. Unread badges will be driven from `user_room_reads`.
--   4. Old backup script and archive queries must be rewritten (see scripts/backup-supabase.ts).
