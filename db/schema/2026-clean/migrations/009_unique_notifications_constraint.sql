-- 009_unique_notifications_constraint.sql
-- Ensure a notification is unique per user/node/feed/type to avoid duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_unique_user_node_feed_type
ON notifications (user_id, node_id, feed_id, type);

-- Optional: remove exact duplicate rows keeping the earliest id
DELETE FROM notifications a
USING notifications b
WHERE a.id > b.id
  AND a.user_id = b.user_id
  AND COALESCE(a.node_id, -1) = COALESCE(b.node_id, -1)
  AND COALESCE(a.feed_id, -1) = COALESCE(b.feed_id, -1)
  AND a.type = b.type;
