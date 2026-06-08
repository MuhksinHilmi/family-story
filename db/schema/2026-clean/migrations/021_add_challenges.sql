-- =============================================================================
-- HALAQAH - Challenges & Engagement
-- Migration: create challenges and submissions tables
-- =============================================================================

-- 1) Challenges table
-- Defined by the admin or AI for a specific halaqah
CREATE TABLE IF NOT EXISTS challenges (
  id BIGSERIAL PRIMARY KEY,
  halaqah_id INTEGER NOT NULL REFERENCES halaqahs(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  due_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2) Challenge Submissions table
-- Families upload their practice results here
CREATE TABLE IF NOT EXISTS challenge_submissions (
  id BIGSERIAL PRIMARY KEY,
  challenge_id INTEGER NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  nuclear_family_id INTEGER NOT NULL REFERENCES nuclear_families(id) ON DELETE CASCADE,
  content_url TEXT, -- URL to the uploaded image/video/document
  description TEXT, -- Family's reflection or story about the practice
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(challenge_id, nuclear_family_id) -- One submission per family per challenge
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_challenges_halaqah ON challenges(halaqah_id);
CREATE INDEX IF NOT EXISTS idx_submissions_challenge ON challenge_submissions(challenge_id);
CREATE INDEX IF NOT EXISTS idx_submissions_family ON challenge_submissions(nuclear_family_id);

-- Seed a sample challenge for testing
-- (Note: we'll need a valid halaqah_id in a real scenario, but adding logic in API to create first one)
-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
