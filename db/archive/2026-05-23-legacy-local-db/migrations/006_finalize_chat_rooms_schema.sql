-- Migration 006: Finalize chat_rooms schema for family_uuid + scope_type + small_family_id
-- This migration ensures the chat_rooms table is in the correct final state
-- for supporting both General Family Chat and Small/Nuclear Family Chat (per father).

-- This migration is safe to run on both fresh databases and existing ones.

-- 1. Ensure required columns exist
ALTER TABLE chat_rooms
  ADD COLUMN IF NOT EXISTS family_uuid UUID;

ALTER TABLE chat_rooms
  ADD COLUMN IF NOT EXISTS scope_type TEXT NOT NULL DEFAULT 'general'
    CHECK (scope_type IN ('general', 'small'));

ALTER TABLE chat_rooms
  ADD COLUMN IF NOT EXISTS small_family_id INTEGER;

-- 2. Drop old problematic unique constraint (if still exists)
-- This was created in earlier migrations and references family_id (legacy)
ALTER TABLE chat_rooms
  DROP CONSTRAINT IF EXISTS chat_rooms_family_id_scope_type_small_family_id_key;

-- 3. Add the correct unique constraint based on family_uuid
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chat_rooms_family_uuid_scope_small_unique'
          AND conrelid = 'chat_rooms'::regclass
    ) THEN
        ALTER TABLE chat_rooms
        ADD CONSTRAINT chat_rooms_family_uuid_scope_small_unique
        UNIQUE (family_uuid, scope_type, small_family_id);
    END IF;
END $$;

-- 4. Add foreign key to families.uuid (safe way for PG14)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_chat_rooms_family_uuid'
          AND conrelid = 'chat_rooms'::regclass
    ) THEN
        ALTER TABLE chat_rooms
        ADD CONSTRAINT fk_chat_rooms_family_uuid
        FOREIGN KEY (family_uuid) REFERENCES families(uuid)
        ON DELETE CASCADE;
    END IF;
END $$;

-- 5. Backfill family_uuid from families table (if any rows are missing it)
UPDATE chat_rooms cr
SET family_uuid = f.uuid
FROM families f
WHERE cr.family_id = f.id
  AND cr.family_uuid IS NULL;

-- 6. Ensure all existing rooms are marked as 'general' (if scope_type is empty)
UPDATE chat_rooms
SET scope_type = 'general'
WHERE scope_type IS NULL OR scope_type = '';

-- 7. Create / ensure required indexes
CREATE INDEX IF NOT EXISTS idx_chat_rooms_family_uuid
  ON chat_rooms (family_uuid);

CREATE INDEX IF NOT EXISTS idx_chat_rooms_family_uuid_scope
  ON chat_rooms (family_uuid, scope_type);

CREATE INDEX IF NOT EXISTS idx_chat_rooms_small_family
  ON chat_rooms (small_family_id)
  WHERE scope_type = 'small';

-- 8. (Recommended) Make family_uuid NOT NULL after backfill
-- We do this conditionally to avoid breaking existing environments
DO $$
BEGIN
    -- Only set NOT NULL if there are no NULL values left
    IF NOT EXISTS (
        SELECT 1 FROM chat_rooms WHERE family_uuid IS NULL
    ) THEN
        ALTER TABLE chat_rooms
        ALTER COLUMN family_uuid SET NOT NULL;
    END IF;
END $$;

-- 9. Add helpful comments
COMMENT ON COLUMN chat_rooms.family_uuid IS 'Stable UUID of the family (main identifier for chat rooms)';
COMMENT ON COLUMN chat_rooms.scope_type IS 'general = whole family chat, small = nuclear family chat of one father';
COMMENT ON COLUMN chat_rooms.small_family_id IS 'References family_nodes.id of the father (only used for small rooms)';
COMMENT ON CONSTRAINT chat_rooms_family_uuid_scope_small_unique ON chat_rooms IS 'Ensures one general + one small room per father per family';

-- Note: The old index on (family_id) is intentionally kept for now for backward compatibility with tree logic.
