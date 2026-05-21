-- Migration 009: Change small_family_id to UUID (users.uuid of the husband/father)
-- This aligns with the new model:
--   - General room = family_uuid
--   - Small room (Keluarga Inti) = family_uuid + users.uuid (of the husband/father)
--
-- Only men who have a spouse will have their own small family chat room.
-- Wives and children will get access to the small room of their husband/father.

-- 1. Add new column for the husband's user UUID
ALTER TABLE chat_rooms
ADD COLUMN IF NOT EXISTS small_family_uuid UUID;

-- 2. (Optional but recommended for clarity) Rename old column if you want to keep it temporarily for migration
-- We will drop the old integer column after confirming data migration.

-- 3. Drop the old unique constraint that used small_family_id (integer)
ALTER TABLE chat_rooms
DROP CONSTRAINT IF EXISTS chat_rooms_family_uuid_scope_small_unique;

-- 4. Add new unique constraint using small_family_uuid
ALTER TABLE chat_rooms
ADD CONSTRAINT chat_rooms_family_uuid_scope_small_unique
UNIQUE (family_uuid, scope_type, small_family_uuid);

-- 5. Drop old indexes related to small_family_id (integer)
DROP INDEX IF EXISTS idx_chat_rooms_small_family;

-- 6. Create new index for small_family_uuid
CREATE INDEX IF NOT EXISTS idx_chat_rooms_small_family_uuid
ON chat_rooms (small_family_uuid);

CREATE INDEX IF NOT EXISTS idx_chat_rooms_family_uuid_scope_small
ON chat_rooms (family_uuid, scope_type, small_family_uuid);

-- 7. Update comments
COMMENT ON COLUMN chat_rooms.small_family_id IS
'DEPRECATED (kept for backward compatibility during transition). Use small_family_uuid instead.';

COMMENT ON COLUMN chat_rooms.small_family_uuid IS
'UUID of the husband/father (from users.uuid). This + family_uuid identifies a nuclear family chat room (Keluarga Inti). Only men with a spouse get their own small room.';

-- 8. (Dev only) Drop the old integer column if you are okay losing old data
-- Uncomment the line below if you want to clean it up now:
-- ALTER TABLE chat_rooms DROP COLUMN IF EXISTS small_family_id;

-- Note:
-- After this migration, all new small rooms will store the husband's users.uuid in small_family_uuid.
-- Existing small rooms (if any) will need manual migration or can be recreated.