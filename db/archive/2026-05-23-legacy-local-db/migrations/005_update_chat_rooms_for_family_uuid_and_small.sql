-- Migration 005: Update chat_rooms to support family_uuid + scope_type + small_family_id
-- This migration prepares the chat system for:
--   - General family chat (scope_type = 'general')
--   - Small/nuclear family chat per father (scope_type = 'small', small_family_id = family_nodes.id of the father)

-- 1. Add new columns (if not exists)
ALTER TABLE chat_rooms
  ADD COLUMN IF NOT EXISTS family_uuid UUID;

ALTER TABLE chat_rooms
  ADD COLUMN IF NOT EXISTS scope_type TEXT NOT NULL DEFAULT 'general'
    CHECK (scope_type IN ('general', 'small'));

ALTER TABLE chat_rooms
  ADD COLUMN IF NOT EXISTS small_family_id INTEGER;   -- references family_nodes.id (the father)

-- 2. Add foreign key for family_uuid (recommended)
ALTER TABLE chat_rooms
  ADD CONSTRAINT IF NOT EXISTS fk_chat_rooms_family_uuid
  FOREIGN KEY (family_uuid) REFERENCES families(uuid)
  ON DELETE CASCADE;

-- 3. Backfill existing rooms (set family_uuid from families table)
UPDATE chat_rooms cr
SET family_uuid = f.uuid
FROM families f
WHERE cr.family_id = f.id
  AND cr.family_uuid IS NULL;

-- 4. Set all existing rooms as 'general' (they were created before small room feature)
UPDATE chat_rooms
SET scope_type = 'general'
WHERE scope_type IS NULL OR scope_type = '';

-- 5. Create useful indexes
CREATE INDEX IF NOT EXISTS idx_chat_rooms_family_uuid ON chat_rooms (family_uuid);
CREATE INDEX IF NOT EXISTS idx_chat_rooms_family_uuid_scope ON chat_rooms (family_uuid, scope_type);
CREATE INDEX IF NOT EXISTS idx_chat_rooms_small_family ON chat_rooms (small_family_id) WHERE scope_type = 'small';

-- 6. (Optional but recommended) Make family_uuid NOT NULL after backfill
-- ALTER TABLE chat_rooms ALTER COLUMN family_uuid SET NOT NULL;

COMMENT ON COLUMN chat_rooms.family_uuid IS 'Stable UUID of the family (replaces reliance on integer family_id for chat)';
COMMENT ON COLUMN chat_rooms.scope_type IS 'general = whole family, small = nuclear family of one father';
COMMENT ON COLUMN chat_rooms.small_family_id IS 'family_nodes.id of the father (only used when scope_type = small)';
