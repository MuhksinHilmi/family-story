-- Migration 012: Family Feeds (Photo Moments)
-- This feature replaces the old dashboard with a family-scoped photo feed.
-- All feeds are private to the family (scoped by family_uuid).
-- Supports multiple images (max 6 per post as per requirement).
-- Includes Likes and 1-level Comments.

-- =============================================================================
-- 1. Main Feeds Table
-- =============================================================================
CREATE TABLE IF NOT EXISTS family_feeds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_uuid UUID NOT NULL REFERENCES families(uuid) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  caption TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast fetching latest feeds per family
CREATE INDEX IF NOT EXISTS idx_family_feeds_family_created 
  ON family_feeds (family_uuid, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_family_feeds_user 
  ON family_feeds (user_id);

COMMENT ON TABLE family_feeds IS 'Family photo moments feed. Each post belongs to one family (family_uuid).';
COMMENT ON COLUMN family_feeds.caption IS 'Optional short caption/description for the post (photo-first experience).';

-- =============================================================================
-- 2. Feed Media (Images & Future Videos)
-- =============================================================================
CREATE TABLE IF NOT EXISTS feed_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feed_id UUID NOT NULL REFERENCES family_feeds(id) ON DELETE CASCADE,
  media_url TEXT NOT NULL,
  media_type TEXT NOT NULL DEFAULT 'image' CHECK (media_type IN ('image', 'video')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  thumbnail_url TEXT,                    -- useful for videos later
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feed_media_feed 
  ON feed_media (feed_id, sort_order);

COMMENT ON TABLE feed_media IS 'Media attachments for family feeds. Supports multiple images per post (max 6 recommended in UI).';
COMMENT ON COLUMN feed_media.sort_order IS 'Order of media within a single feed post (for album display).';

-- =============================================================================
-- 3. Feed Likes
-- =============================================================================
CREATE TABLE IF NOT EXISTS feed_likes (
  feed_id UUID NOT NULL REFERENCES family_feeds(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (feed_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_feed_likes_feed 
  ON feed_likes (feed_id);

COMMENT ON TABLE feed_likes IS 'Likes on family feed posts. One user can like a post only once.';

-- =============================================================================
-- 4. Feed Comments (1 Level Only)
-- =============================================================================
CREATE TABLE IF NOT EXISTS feed_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feed_id UUID NOT NULL REFERENCES family_feeds(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feed_comments_feed_created 
  ON feed_comments (feed_id, created_at DESC);

COMMENT ON TABLE feed_comments IS 'Comments on family feed posts. Currently 1-level only (no nested replies).';

-- =============================================================================
-- End of Migration 012
-- =============================================================================
-- Notes for future:
-- - Video support is prepared in feed_media (media_type = 'video')
-- - Max 6 media per post should be enforced in API/UI layer
-- - Soft delete can be added later if needed (add deleted_at column)
-- - Feed can later support "family room" tagging if multiple families exist
