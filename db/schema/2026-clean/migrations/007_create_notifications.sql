-- 007_create_notifications.sql
-- Table for in-app notifications and email-triggering events

CREATE TABLE IF NOT EXISTS notifications (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    node_id INTEGER NULL REFERENCES nodes(id) ON DELETE SET NULL,
    feed_id BIGINT NULL REFERENCES feeds(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- e.g. 'mention', 'comment', 'like'
    actor_user_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
    data JSONB NULL, -- extra payload
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_feed_id ON notifications(feed_id);

COMMENT ON TABLE notifications IS 'In-app notifications; also used to trigger email alerts (mentions, invites, etc.)';
COMMENT ON COLUMN notifications.data IS 'Arbitrary JSON for additional context (e.g., mention_text).';
