-- =============================================================================
-- Migration: 001_create_extended_family_groups.sql
-- DEPRECATED: These tables are now included in init.sql (2026-05-25)
-- This file is kept for backwards compatibility.
-- =============================================================================

-- Skip if tables already exist (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'extended_family_groups') THEN
        CREATE TABLE extended_family_groups (
            id BIGSERIAL PRIMARY KEY,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'node_extended_groups') THEN
        CREATE TABLE node_extended_groups (
            node_id INTEGER NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
            extended_group_id BIGINT NOT NULL REFERENCES extended_family_groups(id) ON DELETE CASCADE,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            PRIMARY KEY (node_id, extended_group_id)
        );
    END IF;
END $$;

-- Indexes (safe to run multiple times)
CREATE INDEX IF NOT EXISTS idx_node_extended_groups_node_id ON node_extended_groups(node_id);
CREATE INDEX IF NOT EXISTS idx_node_extended_groups_extended_group_id ON node_extended_groups(extended_group_id);
