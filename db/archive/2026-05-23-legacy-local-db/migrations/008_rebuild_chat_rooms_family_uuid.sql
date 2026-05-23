-- Migration 008: Rebuild chat_rooms to use family_uuid as primary logical identifier
-- General room  = family_uuid
-- Small room    = family_uuid + small_family_id (father's family_nodes.id)

-- 1. Ensure family_uuid is NOT NULL (it should already be populated)
ALTER TABLE chat_rooms ALTER COLUMN family_uuid SET NOT NULL;

-- 2. Drop old unique constraint that used integer family_id (if still exists)
ALTER TABLE chat_rooms 
  DROP CONSTRAINT IF EXISTS chat_rooms_family_id_scope_type_small_family_id_key;

-- 3. Ensure the correct unique constraint on the new logical key
-- (family_uuid, scope_type, small_family_id) must be unique
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'chat_rooms_family_uuid_scope_small_unique'
    ) THEN
        ALTER TABLE chat_rooms
        ADD CONSTRAINT chat_rooms_family_uuid_scope_small_unique
        UNIQUE (family_uuid, scope_type, small_family_id);
    END IF;
END $$;

-- 4. Add helpful indexes
CREATE INDEX IF NOT EXISTS idx_chat_rooms_family_uuid 
  ON chat_rooms (family_uuid);

CREATE INDEX IF NOT EXISTS idx_chat_rooms_family_uuid_scope 
  ON chat_rooms (family_uuid, scope_type);

-- 5. (Optional but recommended) Add comment for clarity
COMMENT ON COLUMN chat_rooms.family_uuid IS 'Stable UUID of the family. This + scope_type + small_family_id forms the logical room key.';
COMMENT ON COLUMN chat_rooms.small_family_id IS 'family_nodes.id of the father (only used when scope_type = small). Used together with family_uuid to identify nuclear family chat.';

-- 6. Ensure foreign key to families.uuid exists and is correct
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'fk_chat_rooms_family_uuid'
    ) THEN
        ALTER TABLE chat_rooms
        ADD CONSTRAINT fk_chat_rooms_family_uuid
        FOREIGN KEY (family_uuid) REFERENCES families(uuid) ON DELETE CASCADE;
    END IF;
END $$;