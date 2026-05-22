-- Supabase Migration 002 (HISTORICAL / 2024-2025 era)
-- This file was used during the transition from integer family_id to family_uuid + small_family_id.
--
-- ⚠️ 2026 CLEANUP NOTICE:
-- - All `room_id` references have been REMOVED from the final schema (see 001_create_messages_realtime_broadcast.sql).
-- - `small_family_id` is now UUID (users.uuid of husband), not INTEGER (see local migration 009).
-- - Do NOT run this file as-is on a fresh Supabase project after 2026.
-- - The authoritative, clean definition of the `messages` table is in migration 001 (after cleanup).
--
-- This file is kept only for historical record of how the schema evolved.
-- If you are applying migrations in order, run 001 (clean version) instead of relying on this file.

-- Original content below is left for reference only.

-- 1. Add new columns
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS family_uuid UUID;

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS scope_type TEXT NOT NULL DEFAULT 'general'
    CHECK (scope_type IN ('general', 'small'));

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS small_family_id INTEGER;

-- 2. Backfill family_uuid from families table (if you still have old integer family_id data)
-- Note: This assumes you have a way to map old family_id to uuid.
-- If your messages table is still small/new, you can skip or manually map.
UPDATE public.messages m
SET family_uuid = f.uuid
FROM public.families f
WHERE m.family_id = f.id
  AND m.family_uuid IS NULL;

-- 3. Create useful indexes
CREATE INDEX IF NOT EXISTS idx_messages_family_uuid ON public.messages (family_uuid);
CREATE INDEX IF NOT EXISTS idx_messages_family_uuid_created_at ON public.messages (family_uuid, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_room_family ON public.messages (room_id, family_uuid);

-- 4. Update the broadcast trigger function to use family_uuid and new topic format
CREATE OR REPLACE FUNCTION public.broadcast_new_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  topic_name TEXT;
BEGIN
  IF NEW.scope_type = 'general' THEN
    topic_name := 'family:' || NEW.family_uuid || ':general';
  ELSE
    topic_name := 'family:' || NEW.family_uuid || ':small:' || COALESCE(NEW.small_family_id::text, '');
  END IF;

  -- LEGACY payload (still contains room_id for historical reference only)
  -- Current production trigger (2026) is defined in 001_create_messages_realtime_broadcast.sql
  -- and does NOT include room_id.
  PERFORM realtime.send(
    jsonb_build_object(
      'id', NEW.id,
      'room_id', NEW.room_id,   -- ← removed in final 2026 schema
      'family_uuid', NEW.family_uuid,
      'scope_type', NEW.scope_type,
      'small_family_id', NEW.small_family_id,
      'sender_id', NEW.sender_id,
      'sender_name_snapshot', NEW.sender_name_snapshot,
      'body', NEW.body,
      'created_at', NEW.created_at
    ),
    'message_created',
    topic_name,
    true
  );

  RETURN NULL;
END;
$$;

-- 5. Re-attach the trigger (drop first to avoid duplicates)
DROP TRIGGER IF EXISTS messages_broadcast_trigger ON public.messages;
CREATE TRIGGER messages_broadcast_trigger
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.broadcast_new_message();

-- 6. Historical comments (updated during 2026 cleanup)
COMMENT ON COLUMN public.messages.family_uuid IS 'Stable UUID of the family (main identifier for chat & realtime) - still valid';
COMMENT ON COLUMN public.messages.scope_type IS 'general = whole family, small = nuclear family of one father - still valid';
COMMENT ON COLUMN public.messages.small_family_id IS 'DEPRECATED in this file: was INTEGER (family_nodes.id). In final 2026 schema it is UUID (users.uuid of husband). See migration 001 final version.';

-- Note (2026):
-- This migration is kept for history. The clean, current definition of the messages table + trigger
-- lives in 001_create_messages_realtime_broadcast.sql (after room_id removal).
