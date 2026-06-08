-- =============================================================================
-- HALAQAH - Professional Profile Expansion
-- Migration: Add skills to nodes + create node_experiences table
-- =============================================================================

-- 1) Add skills column to nodes
-- Using TEXT[] for multi-skill support
ALTER TABLE nodes ADD COLUMN IF NOT EXISTS skills TEXT[];

-- 2) Create node_experiences table (LinkedIn-style work history)
CREATE TABLE IF NOT EXISTS node_experiences (
  id BIGSERIAL PRIMARY KEY,
  node_id INTEGER NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  company_name VARCHAR(255) NOT NULL,
  role VARCHAR(255),
  start_date DATE,
  end_date DATE,
  description TEXT,
  is_public BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for experiences
CREATE INDEX IF NOT EXISTS idx_node_experiences_node ON node_experiences(node_id);

-- =============================================================================
-- END OF PROFESSIONAL PROFILE MIGRATION
-- =============================================================================
