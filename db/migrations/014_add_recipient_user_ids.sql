-- Migration 014: Add recipient_user_ids for granular sharing in Family Feeds
-- This allows posting to "Keluarga Inti" but only sharing with specific members (optional).

ALTER TABLE family_feeds
ADD COLUMN IF NOT EXISTS recipient_user_ids JSONB;

COMMENT ON COLUMN family_feeds.recipient_user_ids IS 
'Array of user UUIDs. If NULL or empty → visible to all members according to scope_type.
If filled → only these users can see the post (used for selective sharing in Keluarga Inti).';

-- Optional index for future queries (GIN index for JSONB array search)
CREATE INDEX IF NOT EXISTS idx_family_feeds_recipients 
ON family_feeds USING GIN (recipient_user_ids);
