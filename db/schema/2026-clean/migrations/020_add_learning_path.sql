-- =============================================================================
-- HALAQAH - Learning Path & Progress
-- Migration: create learning_paths, learning_steps, and progress tables
-- =============================================================================

-- 1) Learning Path Templates
-- These are the predefined curriculums for different themes (Parenting, etc.)
CREATE TABLE IF NOT EXISTS learning_paths (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  theme VARCHAR(50) NOT NULL, -- 'parenting', 'pranikah', 'belajar anak'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2) Steps within a Learning Path
CREATE TABLE IF NOT EXISTS learning_steps (
  id BIGSERIAL PRIMARY KEY,
  path_id INTEGER NOT NULL REFERENCES learning_paths(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT, -- Guidelines or description of the step
  suggested_topics TEXT[], -- Tags for the content
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(path_id, step_order)
);

-- 3) Progress of a specific Halaqah through a Path
-- Tracks which nuclear families have completed which step
CREATE TABLE IF NOT EXISTS halaqah_step_progress (
  id BIGSERIAL PRIMARY KEY,
  halaqah_id INTEGER NOT NULL REFERENCES halaqahs(id) ON DELETE CASCADE,
  step_id INTEGER NOT NULL REFERENCES learning_steps(id) ON DELETE CASCADE,
  nuclear_family_id INTEGER NOT NULL REFERENCES nuclear_families(id) ON DELETE CASCADE,
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(halaqah_id, step_id, nuclear_family_id)
);

-- 4) Link Halaqah to a Path
ALTER TABLE halaqahs ADD COLUMN IF NOT EXISTS learning_path_id INTEGER REFERENCES learning_paths(id);
ALTER TABLE halaqahs ADD COLUMN IF NOT EXISTS current_step_index INTEGER DEFAULT 0;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_learning_steps_path ON learning_steps(path_id);
CREATE INDEX IF NOT EXISTS idx_progress_halaqah_step ON halaqah_step_progress(halaqah_id, step_id);
CREATE INDEX IF NOT EXISTS idx_progress_family ON halaqah_step_progress(nuclear_family_id);

-- Seed some basic paths for testing
INSERT INTO learning_paths (name, description, theme) VALUES
('Fondasi Parenting Islami', 'Dasar-dasar pola asuh anak sesuai sunnah', 'parenting'),
('Kesiapan Pranikah', 'Membangun visi misi keluarga sebelum menikah', 'pranikah'),
('Adab & Akhlak Anak', 'Mengajarkan adab harian untuk anak usia dini', 'belajar anak');

INSERT INTO learning_steps (path_id, step_order, title, content) VALUES
(1, 0, 'Visi Keluarga', 'Mendiskusikan tujuan besar keluarga dalam mendidik anak.'),
(1, 1, 'Mengenal Karakter Anak', 'Mengidentifikasi tipe kepribadian anak dan cara berkomunikasi.'),
(1, 2, 'Konsistensi Orang Tua', 'Menyamakan pola asuh antara Ayah dan Ibu.'),
(2, 0, 'Mengenal Diri', 'Evaluasi diri sebelum memasuki kehidupan pernikahan.'),
(2, 1, 'Hak & Kewajiban', 'Memahami tanggung jawab suami dan istri.'),
(3, 0, 'Adab Makan & Minum', 'Praktik harian adab makan bersama keluarga.');

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
