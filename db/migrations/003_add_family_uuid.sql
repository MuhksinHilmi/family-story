-- Migration 003: Add stable UUID for families (family_uuid)
-- This allows chat + Supabase to use UUID for family identification
-- while keeping the existing integer ID system for the family tree (safe migration).

-- 1. Add uuid column to families (stable identifier for chat & future sync)
ALTER TABLE families
  ADD COLUMN IF NOT EXISTS uuid UUID UNIQUE DEFAULT gen_random_uuid();

-- 2. Backfill UUID for existing families (if any)
UPDATE families
SET uuid = gen_random_uuid()
WHERE uuid IS NULL;

-- Make it NOT NULL after backfill
ALTER TABLE families
  ALTER COLUMN uuid SET NOT NULL;

-- 3. Add family_uuid to chat_rooms (preferred over integer family_id for chat)
ALTER TABLE chat_rooms
  ADD COLUMN IF NOT EXISTS family_uuid UUID;

-- Backfill from families.uuid
UPDATE chat_rooms cr
SET family_uuid = f.uuid
FROM families f
WHERE cr.family_id = f.id AND cr.family_uuid IS NULL;

-- 4. Update chat_message_archive to support family_uuid
ALTER TABLE chat_message_archive
  ADD COLUMN IF NOT EXISTS family_uuid UUID;

-- 5. Create index
CREATE INDEX IF NOT EXISTS idx_families_uuid ON families(uuid);
CREATE INDEX IF NOT EXISTS idx_chat_rooms_family_uuid ON chat_rooms(family_uuid);

COMMENT ON COLUMN families.uuid IS 'Stable UUID identifier for this family (used for chat rooms, Supabase messages, and cross-system sync)';
COMMENT ON COLUMN chat_rooms.family_uuid IS 'UUID reference to families.uuid - preferred for chat & realtime';
