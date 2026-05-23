-- Migration 013: Add proper visibility columns to family_feeds
-- This replaces the temporary metadata-based visibility approach.
-- Now using explicit columns for better performance, indexing, and future querying.

-- Add scope_type column (similar to chat system)
ALTER TABLE family_feeds
ADD COLUMN IF NOT EXISTS scope_type TEXT NOT NULL DEFAULT 'general'
  CHECK (scope_type IN ('general', 'small'));

-- Add small_family_uuid (the husband/father's uuid for nuclear family)
ALTER TABLE family_feeds
ADD COLUMN IF NOT EXISTS small_family_uuid UUID;

-- Add useful indexes for filtering feeds by visibility
CREATE INDEX IF NOT EXISTS idx_family_feeds_family_scope_created
  ON family_feeds (family_uuid, scope_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_family_feeds_small_family_created
  ON family_feeds (small_family_uuid, created_at DESC)
  WHERE scope_type = 'small';

-- Add comment for documentation
COMMENT ON COLUMN family_feeds.scope_type IS 
  'Visibility scope: general = Keluarga Besar, small = Keluarga Inti (nuclear family)';

COMMENT ON COLUMN family_feeds.small_family_uuid IS 
  'Only filled when scope_type = small. Refers to the husband/father users.uuid of the nuclear family.';
