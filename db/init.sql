-- =============================================================================
-- FAMILY STORY - Complete Initial Database Setup (Local Postgres)
-- =============================================================================
-- File ini digunakan untuk fresh install (development & VPS).
-- Jalankan sekali:
--   psql -d family_story -f db/init.sql
--
-- Untuk perubahan selanjutnya, gunakan file di folder:
--   db/migrations/   → perubahan incremental
--   db/supabase/     → migration untuk Supabase
--
-- Arsitektur saat ini:
-- - family_id (INTEGER)  → untuk relasi internal tree
-- - family_uuid (UUID)   → identifier utama untuk chat, invitation, realtime
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- =============================================================================
-- 1. CORE TABLES
-- =============================================================================
-- Users
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20),
  gender VARCHAR(10),
  birth_date DATE,
  is_email_verified BOOLEAN DEFAULT false,
  is_phone_verified BOOLEAN DEFAULT false,
  otp VARCHAR(6),
  otp_expires_at TIMESTAMP,
  activation_token VARCHAR(64),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
-- Families (dengan family_uuid sebagai identifier utama)
CREATE TABLE IF NOT EXISTS families (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_by INTEGER REFERENCES users(id),
  uuid UUID UNIQUE DEFAULT gen_random_uuid(),     -- ← Stable identifier
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
-- Family Members
CREATE TABLE IF NOT EXISTS family_members (
  id SERIAL PRIMARY KEY,
  family_id INTEGER REFERENCES families(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at TIMESTAMP DEFAULT NOW()
);
-- Family Tree Nodes
CREATE TABLE IF NOT EXISTS family_nodes (
  id SERIAL PRIMARY KEY,
  family_id INTEGER REFERENCES families(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  full_name VARCHAR(255) NOT NULL,
  gender VARCHAR(10) NOT NULL CHECK (gender IN ('male', 'female')),
  birth_date DATE,
  death_date DATE,
  photo_url TEXT,
  is_alive BOOLEAN DEFAULT true,
  nasab_line VARCHAR(10) CHECK (nasab_line IN ('father', 'mother')),
  birth_order INTEGER,
  father_id INTEGER REFERENCES family_nodes(id) ON DELETE SET NULL,
  mother_id INTEGER REFERENCES family_nodes(id) ON DELETE SET NULL,
  position_x INTEGER DEFAULT 0,
  position_y INTEGER DEFAULT 0,
  invitation_email VARCHAR(255),
  invitation_status VARCHAR(20) DEFAULT 'accepted' CHECK (invitation_status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
-- Spouse Relations
CREATE TABLE IF NOT EXISTS spouse_relations (
  id SERIAL PRIMARY KEY,
  family_id INTEGER REFERENCES families(id) ON DELETE CASCADE,
  node_a INTEGER REFERENCES family_nodes(id) ON DELETE CASCADE,
  node_b INTEGER REFERENCES family_nodes(id) ON DELETE CASCADE,
  marriage_date DATE,
  marriage_location TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(node_a, node_b)
);
-- Invitations (sudah support family_uuid)
CREATE TABLE IF NOT EXISTS invitations (
  id SERIAL PRIMARY KEY,
  family_id INTEGER REFERENCES families(id) ON DELETE CASCADE,
  family_uuid UUID REFERENCES families(uuid),      -- ← Stable identifier
  email VARCHAR(255) NOT NULL,
  token VARCHAR(64) UNIQUE NOT NULL,
  invited_by INTEGER REFERENCES users(id),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
-- =============================================================================
-- 2. CHAT SYSTEM (Sudah mendukung General + Small Room)
-- =============================================================================
-- Chat Rooms
CREATE TABLE IF NOT EXISTS chat_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  family_uuid UUID NOT NULL REFERENCES families(uuid),  -- ← Identifier utama untuk chat & realtime
  scope_type TEXT NOT NULL DEFAULT 'general' CHECK (scope_type IN ('general', 'small')),
  small_family_id INTEGER,                         -- family_nodes.id dari ayah (hanya untuk small)
  name TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(family_uuid, scope_type, small_family_id)
);
CREATE INDEX IF NOT EXISTS idx_chat_rooms_family_uuid ON chat_rooms(family_uuid);
CREATE INDEX IF NOT EXISTS idx_chat_rooms_family_uuid_scope ON chat_rooms(family_uuid, scope_type);
-- Chat Message Archive (Local)
CREATE TABLE IF NOT EXISTS chat_message_archive (
  id UUID PRIMARY KEY,
  room_id TEXT,
  chat_room_id UUID REFERENCES chat_rooms(id),
  user_id INTEGER,
  content JSONB,
  type TEXT,
  created_at TIMESTAMPTZ,
  edited_at TIMESTAMPTZ,
  deleted BOOLEAN DEFAULT false,
  metadata JSONB,
  backup_date DATE NOT NULL,
  imported_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chat_archive_backup_date ON chat_message_archive (backup_date);
CREATE INDEX IF NOT EXISTS idx_chat_archive_chat_room_id ON chat_message_archive (chat_room_id);
-- Backup Jobs
CREATE TABLE IF NOT EXISTS backup_jobs (
  id SERIAL PRIMARY KEY,
  backup_date DATE,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  status TEXT,
  supabase_count INT,
  local_count INT,
  error_text TEXT
);
CREATE TABLE IF NOT EXISTS backup_job_chunks (
  id SERIAL PRIMARY KEY,
  job_id INT REFERENCES backup_jobs(id) ON DELETE CASCADE,
  chunk_index INT,
  ids JSONB,
  status TEXT,
  processed_at TIMESTAMPTZ
);
-- =============================================================================
-- 3. INDEXES
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_family_nodes_family_id ON family_nodes(family_id);
CREATE INDEX IF NOT EXISTS idx_family_nodes_user_id ON family_nodes(user_id);
CREATE INDEX IF NOT EXISTS idx_invitations_family_id ON invitations(family_id);
CREATE INDEX IF NOT EXISTS idx_invitations_family_uuid ON invitations(family_uuid);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token);
-- =============================================================================
-- 4. DEFAULT DATA
-- =============================================================================
-- Buat 1 General room otomatis untuk setiap family (small rooms dibuat on-demand via getUserChatRooms)
INSERT INTO chat_rooms (family_id, family_uuid, scope_type, name, created_at, updated_at)
SELECT 
  f.id,
  f.uuid,
  'general',
  'Keluarga Besar ' || f.name,
  NOW(),
  NOW()
FROM families f
WHERE NOT EXISTS (
  SELECT 1 FROM chat_rooms cr 
  WHERE cr.family_uuid = f.uuid AND cr.scope_type = 'general'
)
ON CONFLICT (family_uuid, scope_type, small_family_id) DO NOTHING;
-- =============================================================================
-- SELESAI
-- =============================================================================
-- Cara pakai:
-- 1. dropdb family_story && createdb family_story
-- 2. psql -d family_story -f db/init.sql
--
-- Untuk development selanjutnya, gunakan migration di db/migrations/
-- Untuk Supabase, jalankan file di db/supabase/ secara manual
-- =============================================================================