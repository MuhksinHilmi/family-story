-- =============================================================================
-- HALAQAH - Study Circle Feature for CeritaKeluarga
-- Migration: Add occupation to nodes + create halaqahs and members tables
-- =============================================================================

-- 1) Add occupation columns to nodes (for skill discovery)
ALTER TABLE nodes ADD COLUMN IF NOT EXISTS occupation TEXT;
ALTER TABLE nodes ADD COLUMN IF NOT EXISTS occupation_is_public BOOLEAN DEFAULT false;

-- Create index for public occupations (for skill search)
CREATE INDEX IF NOT EXISTS idx_nodes_occupation_public 
  ON nodes(occupation) 
  WHERE occupation_is_public = true AND occupation IS NOT NULL;

-- 2) Create halaqahs table (study circles)
CREATE TABLE IF NOT EXISTS halaqahs (
  id BIGSERIAL PRIMARY KEY,
  uuid UUID UNIQUE DEFAULT gen_random_uuid(),
  nuclear_family_id INTEGER NOT NULL REFERENCES nuclear_families(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(20) NOT NULL CHECK (type IN ('pasangan', 'anak', 'umum')),
  topics TEXT[],
  location_label TEXT,
  location_lat NUMERIC,
  location_lng NUMERIC,
  radius_km INTEGER,
  member_limit INTEGER,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'full', 'archived')),
  chat_room_uuid UUID UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for halaqahs
CREATE INDEX IF NOT EXISTS idx_halaqahs_nuclear_family ON halaqahs(nuclear_family_id);
CREATE INDEX IF NOT EXISTS idx_halaqahs_chat_room ON halaqahs(chat_room_uuid);
CREATE INDEX IF NOT EXISTS idx_halaqahs_type ON halaqahs(type);
CREATE INDEX IF NOT EXISTS idx_halaqahs_status ON halaqahs(status);

-- 3) Create halaqah_members table (membership per study circle)
CREATE TABLE IF NOT EXISTS halaqah_members (
  id BIGSERIAL PRIMARY KEY,
  halaqah_id INTEGER NOT NULL REFERENCES halaqahs(id) ON DELETE CASCADE,
  node_id INTEGER NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'left')),
  is_admin BOOLEAN DEFAULT false,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(halaqah_id, node_id)
);

-- Indexes for halaqah_members
CREATE INDEX IF NOT EXISTS idx_halaqah_members_halaqah ON halaqah_members(halaqah_id);
CREATE INDEX IF NOT EXISTS idx_halaqah_members_node ON halaqah_members(node_id);
CREATE INDEX IF NOT EXISTS idx_halaqah_members_status ON halaqah_members(status);

-- =============================================================================
-- END OF HALAQAH MIGRATION
-- =============================================================================