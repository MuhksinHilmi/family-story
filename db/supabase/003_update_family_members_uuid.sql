-- Migration 003: Update family_members for UUID-based RLS
-- Run after applying migration 007 (users.uuid) locally

-- 1. Update user_id to UUID (must reference users.uuid)
-- This enables RLS policies like: WHERE user_id = auth.uid()
ALTER TABLE public.family_members 
  ALTER COLUMN user_id TYPE UUID USING user_id::uuid;

-- 2. Update family_uuid column (if not already UUID)
-- This enables topic-based membership checks: WHERE family_uuid = split_part(...)::uuid
ALTER TABLE public.family_members
  ALTER COLUMN family_id TYPE UUID USING family_id::uuid;

-- 3. Rename family_id to family_uuid for clarity
ALTER TABLE public.family_members 
  RENAME COLUMN family_id TO family_uuid;

-- 4. Add index for fast lookups
CREATE INDEX IF NOT EXISTS idx_family_members_user_id ON public.family_members (user_id);
CREATE INDEX IF NOT EXISTS idx_family_members_family_uuid ON public.family_members (family_uuid);

-- Note: These changes require:
-- - users.uuid column populated (migration 007)
-- - JWT 'sub' claim uses UUID (login route fix)
-- - messages table uses family_uuid instead of family_id (migration 001 updated)