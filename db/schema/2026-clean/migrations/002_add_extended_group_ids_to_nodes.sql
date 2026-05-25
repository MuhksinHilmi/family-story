-- 002_add_extended_group_ids_to_nodes.sql
-- DEPRECATED: This column is now included in init.sql (2026-05-25)
-- This file is kept for backwards compatibility if reset script runs on an existing installation.
-- Does nothing if column already exists.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'nodes' AND column_name = 'extended_group_ids'
    ) THEN
        ALTER TABLE nodes ADD COLUMN extended_group_ids INTEGER[] DEFAULT '{}';
    END IF;
END $$;
