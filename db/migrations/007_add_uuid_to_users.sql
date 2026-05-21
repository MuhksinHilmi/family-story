-- Migration 007: Add uuid column to users for Supabase auth.uid() compatibility
-- This enables proper RLS in Supabase messages table which uses UUID types

-- 1. Add uuid column (nullable first to allow backfill)
ALTER TABLE users ADD COLUMN IF NOT EXISTS uuid UUID;

-- 2. Backfill existing users with generated UUIDs
UPDATE users SET uuid = gen_random_uuid() WHERE uuid IS NULL;

-- 3. Make uuid NOT NULL after backfill
ALTER TABLE users ALTER COLUMN uuid SET NOT NULL;

-- 4. Add unique constraint (in case you want to reference users by uuid)
ALTER TABLE users ADD CONSTRAINT users_uuid_unique UNIQUE (uuid);

-- 5. Add comment for documentation
COMMENT ON COLUMN users.uuid IS 'UUID used for Supabase auth.uid() claims - enables proper RLS on messages table';