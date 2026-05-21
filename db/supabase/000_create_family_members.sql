-- Migration 000: Create public.family_members table for Supabase RLS
-- This table mirrors the local family_members for Realtime authorization

-- 1. Create the table (mirrors local schema but with UUID types)
CREATE TABLE IF NOT EXISTS public.family_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_uuid UUID NOT NULL,                      -- matches topic parsing
  user_id UUID NOT NULL,                         -- matches auth.uid() from JWT
  role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_family_members_user_id ON public.family_members (user_id);
CREATE INDEX IF NOT EXISTS idx_family_members_family_uuid ON public.family_members (family_uuid);

-- 3. Enable RLS
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policy: Users can view their own membership
CREATE POLICY "users_can_view_own_membership"
  ON public.family_members
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Note: This table must be populated from the local family_members
-- You can set up a cron job or sync process to keep it updated.