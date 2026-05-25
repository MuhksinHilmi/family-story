-- 006_create_feed_interactions.sql
-- Adds like and comment tables for the new feeds system (2026-clean schema)
-- These were missing from the initial feed snapshot migrations (003-005)

-- Feed likes (one user can like a feed at most once)
CREATE TABLE IF NOT EXISTS feed_likes (
    id BIGSERIAL PRIMARY KEY,
    feed_id BIGINT NOT NULL REFERENCES feeds(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (feed_id, user_id)
);

-- Feed comments
CREATE TABLE IF NOT EXISTS feed_comments (
    id BIGSERIAL PRIMARY KEY,
    feed_id BIGINT NOT NULL REFERENCES feeds(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    comment TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_feed_likes_feed_id ON feed_likes(feed_id);
CREATE INDEX IF NOT EXISTS idx_feed_likes_user_id ON feed_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_feed_comments_feed_id ON feed_comments(feed_id);
CREATE INDEX IF NOT EXISTS idx_feed_comments_user_id ON feed_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_feed_comments_created_at ON feed_comments(created_at);

COMMENT ON TABLE feed_likes IS 'Likes on feeds (user-based, one per user per feed)';
COMMENT ON TABLE feed_comments IS 'Comments on feeds (user-based)';
