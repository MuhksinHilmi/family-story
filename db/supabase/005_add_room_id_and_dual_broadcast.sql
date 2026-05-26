-- db/supabase/005_add_room_id_and_dual_broadcast.sql
-- Add room_id column to Supabase transient messages table and update trigger
-- to emit both legacy family topics and new chat_room:{room_id} topic.

-- 1) Add nullable room_id UUID to public.messages
ALTER TABLE IF EXISTS public.messages
  ADD COLUMN IF NOT EXISTS room_id UUID;

CREATE INDEX IF NOT EXISTS idx_messages_room_id ON public.messages (room_id);

-- 2) Replace broadcast function to emit both topics during transition
CREATE OR REPLACE FUNCTION public.broadcast_new_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  topic_family TEXT;
  topic_small TEXT;
  topic_room TEXT;
  payload jsonb;
BEGIN
  -- Legacy family topics (unchanged)
  IF NEW.scope_type = 'general' THEN
    topic_family := 'family:' || NEW.family_uuid || ':general';
  ELSE
    topic_family := 'family:' || NEW.family_uuid || ':small:' || COALESCE(NEW.small_family_id::text, '');
  END IF;

  -- New room topic if provided
  IF NEW.room_id IS NOT NULL THEN
    topic_room := 'chat_room:' || NEW.room_id;
  ELSE
    topic_room := NULL;
  END IF;

  -- Build payload (include room_id for clients)
  payload := jsonb_build_object(
    'id', NEW.id,
    'room_id', NEW.room_id,
    'family_uuid', NEW.family_uuid,
    'scope_type', NEW.scope_type,
    'small_family_id', NEW.small_family_id,
    'sender_id', NEW.sender_id,
    'sender_name_snapshot', NEW.sender_name_snapshot,
    'sender_photo_snapshot', NEW.sender_photo_snapshot,
    'body', NEW.body,
    'created_at', NEW.created_at
  );

  -- Emit to legacy family topic (kept for RLS compatibility)
  PERFORM realtime.send(payload, 'message_created', topic_family, true);

  -- Also emit to room topic if available (new clients subscribe to this)
  IF topic_room IS NOT NULL THEN
    PERFORM realtime.send(payload, 'message_created', topic_room, true);
  END IF;

  RETURN NULL;
END;
$$;

-- Re-attach trigger to ensure new function is used (idempotent)
DROP TRIGGER IF EXISTS messages_broadcast_trigger ON public.messages;
CREATE TRIGGER messages_broadcast_trigger
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.broadcast_new_message();

COMMENT ON COLUMN public.messages.room_id IS 'Optional room UUID (chat_rooms.id) - new topic chat_room:{room_id} will be emitted when present.';
COMMENT ON FUNCTION public.broadcast_new_message() IS 'Broadcasts new message to legacy family topic and new chat_room topic if room_id present.';
