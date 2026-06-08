-- =============================================================================
-- HALAQAH - Invitation & Discovery
-- Migration: create halaqah_invites table
-- =============================================================================

-- Table to handle invitations to start a learning circle (Halaqah)
CREATE TABLE IF NOT EXISTS halaqah_invites (
  id BIGSERIAL PRIMARY KEY,
  sender_node_id INTEGER NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  target_nuclear_family_id INTEGER NOT NULL REFERENCES nuclear_families(id) ON DELETE CASCADE,
  theme VARCHAR(50), -- e.g., 'parenting', 'pranikah', 'belajar anak'
  suggested_skills TEXT[], -- skills that triggered the match
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_halaqah_invites_target ON halaqah_invites(target_nuclear_family_id);
CREATE INDEX IF NOT EXISTS idx_halaqah_invites_sender ON halaqah_invites(sender_node_id);

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
