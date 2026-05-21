-- Supabase Migration 002: Update messages table for family_uuid + scope_type + small_family_id
-- This migration aligns the Supabase messages table with the new chat architecture
-- that uses family_uuid as the primary identifier (instead of integer family_id).

-- Run this in Supabase SQL Editor.

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

  PERFORM realtime.send(
    jsonb_build_object(
      'id', NEW.id,
      'room_id', NEW.room_id,
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

-- 6. (Optional but recommended) Update comments
COMMENT ON COLUMN public.messages.family_uuid IS 'Stable UUID of the family (main identifier for chat & realtime)';
COMMENT ON COLUMN public.messages.scope_type IS 'general = whole family, small = nuclear family of one father';
COMMENT ON COLUMN public.messages.small_family_id IS 'family_nodes.id of the father (only for small rooms)';

-- Note:
-- The old column `family_id` (integer) is kept temporarily for backward compatibility.
-- You can drop it later after fully migrating all references to `family_uuid`.
