-- 005_add_feed_media_and_viewers.sql
-- Adds media storage to feeds and creates feed_viewers table
-- for fast, scalable feed listing queries (denormalized visibility).

-- Add media column (stores array of media objects as JSONB)
-- Example: [{"media_url": "...", "media_type": "image", "sort_order": 0}, ...]
ALTER TABLE feeds
ADD COLUMN IF NOT EXISTS media JSONB NOT NULL DEFAULT '[]';

-- Create feed_viewers table
-- This is the main table used for querying feeds a user can see.
-- Populated at feed creation time based on scope_type (snapshot approach).
CREATE TABLE IF NOT EXISTS feed_viewers (
    feed_id BIGINT NOT NULL REFERENCES feeds(id) ON DELETE CASCADE,
    viewer_node_id INTEGER NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    PRIMARY KEY (feed_id, viewer_node_id)
);

-- Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_feed_viewers_viewer_node_id 
    ON feed_viewers(viewer_node_id);

CREATE INDEX IF NOT EXISTS idx_feed_viewers_feed_id 
    ON feed_viewers(feed_id);

-- Composite index for common query pattern (viewer + recent feeds)
CREATE INDEX IF NOT EXISTS idx_feed_viewers_viewer_feed 
    ON feed_viewers(viewer_node_id, feed_id);

COMMENT ON TABLE feed_viewers IS 
    'Denormalized table for fast feed visibility checks. Contains all viewers who can see each feed at the time it was posted (snapshot).';

COMMENT ON COLUMN feeds.media IS 
    'Array of media objects attached to the feed. Supports multiple images.';