-- Migration 002: Introduce proper chat_rooms with UUID (for realtime + archive)
-- This allows chat to use stable UUID identifiers while keeping the existing family tree on integer IDs.

-- 1. Create chat_rooms table
CREATE TABLE IF NOT EXISTS chat_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  scope_type TEXT NOT NULL DEFAULT 'general' CHECK (scope_type IN ('general', 'small')),
  small_family_id INTEGER,                    -- for future small group chats
  name TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(family_id, scope_type, small_family_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_rooms_family ON chat_rooms(family_id);
CREATE INDEX IF NOT EXISTS idx_chat_rooms_scope ON chat_rooms(scope_type);

-- 2. Backfill: Create a default 'general' chat room for every existing family
INSERT INTO chat_rooms (family_id, scope_type, name, created_at)
SELECT 
  f.id,
  'general',
  'Chat Keluarga ' || f.name,
  NOW()
FROM families f
WHERE NOT EXISTS (
  SELECT 1 FROM chat_rooms cr 
  WHERE cr.family_id = f.id AND cr.scope_type = 'general'
);

-- 3. Update chat_message_archive to support proper room_id (UUID)
-- Add new column first (we will migrate data later)
ALTER TABLE chat_message_archive 
  ADD COLUMN IF NOT EXISTS chat_room_id UUID REFERENCES chat_rooms(id);

-- Create index for the new column
CREATE INDEX IF NOT EXISTS idx_chat_archive_chat_room_id ON chat_message_archive(chat_room_id);

-- Note for future: 
-- We can gradually move data from room_id (TEXT, old family_id) to chat_room_id (UUID)
-- For now, the chat code will prefer chat_room_id when available.

COMMENT ON TABLE chat_rooms IS 'Chat rooms (UUID) linked to families. Used for Supabase Realtime topics and local archive.';
COMMENT ON COLUMN chat_message_archive.chat_room_id IS 'New UUID reference to chat_rooms (preferred over legacy room_id TEXT)';
