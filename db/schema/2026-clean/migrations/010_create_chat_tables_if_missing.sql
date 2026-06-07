-- db/schema/2026-clean/migrations/010_create_chat_tables_if_missing.sql
-- Ensure minimal chat tables exist before running later migrations that alter them.
-- This migration is safe to run on an existing DB (creates tables only if missing).

-- 1) Create chat_rooms table if not exists
CREATE TABLE IF NOT EXISTS chat_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_uuid UUID,
  scope_type TEXT NOT NULL DEFAULT 'general' CHECK (scope_type IN ('general','small')),
  small_family_uuid UUID,
  small_family_id INTEGER,
  extended_group_id BIGINT,
  name TEXT,
  created_by INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_rooms_family_uuid ON chat_rooms(family_uuid);
CREATE INDEX IF NOT EXISTS idx_chat_rooms_ext_group ON chat_rooms(extended_group_id);

-- 2) Create permanent local messages table if not exists
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_room_id UUID,
  family_uuid UUID,
  scope_type TEXT NOT NULL DEFAULT 'general' CHECK (scope_type IN ('general','small')),
  small_family_id UUID,
  sender_id UUID,
  sender_name_snapshot TEXT,
  sender_photo_snapshot TEXT,
  body TEXT,
  type TEXT DEFAULT 'text',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  deleted BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_messages_chat_room_id ON messages(chat_room_id);
CREATE INDEX IF NOT EXISTS idx_messages_family_created_at ON messages(family_uuid, created_at DESC);

-- 3) Ensure minimal permissions/comments (non-destructive)
COMMENT ON TABLE chat_rooms IS 'Chat rooms (UUID) used as logical chat identifiers for local chat and mapping to extended groups.';
COMMENT ON TABLE messages IS 'Permanent local messages (source of truth). Transient Supabase messages replicate here via sync job.';
