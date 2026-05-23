-- Migration 004: Add family_uuid to invitations table
-- This allows invitations to carry the stable external family identifier (UUID)
-- instead of relying solely on internal integer family_id.

-- 1. Add the column
ALTER TABLE invitations
ADD COLUMN IF NOT EXISTS family_uuid UUID;

-- 2. Add foreign key constraint to families.uuid (recommended for data integrity)
ALTER TABLE invitations
ADD CONSTRAINT fk_invitations_family_uuid
FOREIGN KEY (family_uuid) REFERENCES families(uuid)
ON DELETE CASCADE;

-- 3. Backfill existing invitations (if any) using current family_id
UPDATE invitations i
SET family_uuid = f.uuid
FROM families f
WHERE i.family_id = f.id
  AND i.family_uuid IS NULL;

-- 4. Create index for fast lookups by family_uuid (used in chat & future realtime)
CREATE INDEX IF NOT EXISTS idx_invitations_family_uuid
ON invitations (family_uuid);

-- 5. (Optional but recommended) Make family_uuid NOT NULL after backfill in production
-- ALTER TABLE invitations ALTER COLUMN family_uuid SET NOT NULL;

COMMENT ON COLUMN invitations.family_uuid IS 'Stable UUID identifier of the family. Used for chat, realtime topics, and external references. Replaces reliance on integer family_id for invitation flows.';
