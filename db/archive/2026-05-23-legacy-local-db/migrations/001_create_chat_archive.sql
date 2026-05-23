-- Migration: create chat_message_archive and backup_jobs tables

CREATE TABLE IF NOT EXISTS chat_message_archive (
  id UUID PRIMARY KEY,
  room_id TEXT,
  user_id UUID,
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
CREATE INDEX IF NOT EXISTS idx_chat_archive_room_created_at ON chat_message_archive (room_id, created_at);

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
