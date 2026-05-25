-- 003_create_feeds_tables.sql
-- Feeds feature with nuclear family snapshots + custom visibility
-- Designed for 2026 schema (nodes, nuclear_families, extended_family_groups)

-- Main feeds table
CREATE TABLE feeds (
    id BIGSERIAL PRIMARY KEY,
    node_id BIGINT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    caption TEXT,
    scope_type TEXT NOT NULL CHECK (scope_type IN ('extended', 'nuclear', 'custom')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Snapshot of nuclear family viewers at the time the feed was posted.
-- This table stores the "frozen" list of people who can see this specific feed
-- when scope_type = 'nuclear'. It is populated from node_active_nuclear_viewers
-- at creation time and is immutable for historical posts.
CREATE TABLE feed_nuclear_viewers (
    feed_id BIGINT NOT NULL REFERENCES feeds(id) ON DELETE CASCADE,
    viewer_node_id BIGINT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    PRIMARY KEY (feed_id, viewer_node_id)
);

-- For scope_type = 'custom'
-- Only users explicitly selected from the poster's extended family at posting time.
CREATE TABLE feed_custom_viewers (
    feed_id BIGINT NOT NULL REFERENCES feeds(id) ON DELETE CASCADE,
    viewer_node_id BIGINT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    PRIMARY KEY (feed_id, viewer_node_id)
);

-- Current active nuclear family visibility for a node (father-centric).
-- This table is the "live" source of truth for who can see a node's "keluarga inti" posts right now.
-- It is maintained via triggers on marriages and parent_child_relations.
-- Only the father is the anchor for active nuclear family membership.
CREATE TABLE node_active_nuclear_viewers (
    node_id BIGINT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    viewer_node_id BIGINT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    PRIMARY KEY (node_id, viewer_node_id)
);

-- Useful indexes
CREATE INDEX idx_feeds_node_id ON feeds(node_id);
CREATE INDEX idx_feeds_scope_type ON feeds(scope_type);
CREATE INDEX idx_feeds_created_at ON feeds(created_at DESC);

CREATE INDEX idx_feed_nuclear_viewers_feed ON feed_nuclear_viewers(feed_id);
CREATE INDEX idx_feed_nuclear_viewers_viewer ON feed_nuclear_viewers(viewer_node_id);

CREATE INDEX idx_feed_custom_viewers_feed ON feed_custom_viewers(feed_id);
CREATE INDEX idx_feed_custom_viewers_viewer ON feed_custom_viewers(viewer_node_id);

CREATE INDEX idx_node_active_nuclear_node ON node_active_nuclear_viewers(node_id);
CREATE INDEX idx_node_active_nuclear_viewer ON node_active_nuclear_viewers(viewer_node_id);

COMMENT ON TABLE feeds IS 'Main family feeds/posts table with visibility scope';
COMMENT ON TABLE feed_nuclear_viewers IS 'Historical snapshot of nuclear family viewers for a specific feed (immutable after creation)';
COMMENT ON TABLE feed_custom_viewers IS 'Selected viewers for custom visibility feeds (chosen from extended family)';
COMMENT ON TABLE node_active_nuclear_viewers IS 'Current live active nuclear family members for a node (father-anchored, updated by relation triggers)';
COMMENT ON COLUMN feeds.scope_type IS 'extended = keluarga besar, nuclear = keluarga inti (snapshot), custom = manual selection from extended family';