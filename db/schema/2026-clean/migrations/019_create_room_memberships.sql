-- =============================================================================
-- HALAQAH - Chat Room Memberships
-- Migration: create room_memberships table to support multi-family laqah rooms
-- =============================================================================

CREATE TABLE IF NOT EXISTS room_memberships (
  id BIGSERIAL PRIMARY KEY,
  chat_room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL, -- reference to users.id
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(chat_room_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_room_memberships_room ON room_memberships(chat_room_id);
CREATE INDEX IF NOT EXISTS idx_room_memberships_user ON room_memberships(user_id);

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
