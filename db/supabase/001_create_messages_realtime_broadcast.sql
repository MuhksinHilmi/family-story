-- Supabase Migration: Chat messages table + Realtime Broadcast via trigger + Family RLS
-- Follows PRD integration_chat.md + current Supabase Broadcast from Database docs (2026)

-- 1. Core messages table (Supabase - transient source for realtime + 1-day retention via pg_cron)
-- This is NOT the permanent store. Local Postgres `messages` table is the authoritative history.
-- Room is identified by composite key: family_uuid + scope_type + small_family_id (users.uuid of husband)
-- No `room_id` column is used anymore (cleaned up in 2026).
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_uuid UUID NOT NULL,                  -- main logical identifier
  scope_type TEXT NOT NULL DEFAULT 'general' CHECK (scope_type IN ('general', 'small')),
  small_family_id UUID,                       -- users.uuid of husband/father (nullable for general room)
  sender_id UUID NOT NULL,                    -- matches auth.uid()
  sender_name_snapshot TEXT,
  sender_photo_snapshot TEXT,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes (no room_id)
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages (created_at);
CREATE INDEX IF NOT EXISTS idx_messages_family_uuid_created_at ON public.messages (family_uuid, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_room_composite ON public.messages (family_uuid, scope_type, small_family_id, created_at DESC);

-- 2. Enable RLS on messages (public schema)
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies for messages (family-based, avoid BOLA)
-- Requires public.family_members to have user_id as UUID (matches auth.uid())
-- INSERT: only family members can send to their family rooms
CREATE POLICY "family_members_can_insert_messages"
  ON public.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    family_uuid IN (
      SELECT family_uuid FROM public.family_members WHERE user_id = (SELECT auth.uid())
    )
  );

-- SELECT: only family members can read messages of their families
CREATE POLICY "family_members_can_select_messages"
  ON public.messages
  FOR SELECT
  TO authenticated
  USING (
    family_uuid IN (
      SELECT family_uuid FROM public.family_members WHERE user_id = (SELECT auth.uid())
    )
  );

-- 4. Realtime Authorization (Broadcast) - RLS on realtime.messages
-- Allow authenticated family members to receive broadcasts on their family topics
-- Uses family_uuid (from topic) to check membership in public.family_members
CREATE POLICY "family_members_can_receive_broadcasts"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.uid()) IN (
      SELECT user_id FROM public.family_members
      WHERE family_uuid = (
        CASE 
          WHEN (SELECT realtime.topic()) LIKE 'family:%:general' THEN
            (SELECT split_part((SELECT realtime.topic()), ':', 2))::uuid
          WHEN (SELECT realtime.topic()) LIKE 'family:%:small:%' THEN
            (SELECT split_part((SELECT realtime.topic()), ':', 2))::uuid
          ELSE NULL
        END
      )
    )
    AND extension = 'broadcast'
  );

-- Allow authenticated family members to send (if using client-side broadcast, optional)
CREATE POLICY "family_members_can_send_broadcasts"
  ON realtime.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) IN (
      SELECT user_id FROM public.family_members
      WHERE family_uuid = (
        CASE 
          WHEN (SELECT realtime.topic()) LIKE 'family:%:general' THEN
            (SELECT split_part((SELECT realtime.topic()), ':', 2))::uuid
          WHEN (SELECT realtime.topic()) LIKE 'family:%:small:%' THEN
            (SELECT split_part((SELECT realtime.topic()), ':', 2))::uuid
          ELSE NULL
        END
      )
    )
    AND extension = 'broadcast'
  );

-- 5. Trigger function: AFTER INSERT on messages → broadcast via realtime.send (custom payload per PRD)
CREATE OR REPLACE FUNCTION public.broadcast_new_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  topic_name TEXT;
BEGIN
  -- Deterministic topic per PRD (using family_uuid)
  IF NEW.scope_type = 'general' THEN
    topic_name := 'family:' || NEW.family_uuid || ':general';
  ELSE
    topic_name := 'family:' || NEW.family_uuid || ':small:' || COALESCE(NEW.small_family_id::text, '');
  END IF;

  -- Broadcast custom payload (no room_id - 2026 cleanup)
  -- Frontend maps these fields directly to ChatMessage type.
  PERFORM realtime.send(
    jsonb_build_object(
      'id', NEW.id,
      'family_uuid', NEW.family_uuid,
      'scope_type', NEW.scope_type,
      'small_family_id', NEW.small_family_id,
      'sender_id', NEW.sender_id,
      'sender_name_snapshot', NEW.sender_name_snapshot,
      'sender_photo_snapshot', NEW.sender_photo_snapshot,
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

-- 6. Attach trigger (only on INSERT for new messages, per PRD flow)
DROP TRIGGER IF EXISTS messages_broadcast_trigger ON public.messages;
CREATE TRIGGER messages_broadcast_trigger
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.broadcast_new_message();

-- 7. Optional: expose messages to Data API (if not auto-exposed)
-- GRANT SELECT, INSERT ON public.messages TO anon, authenticated;
-- (RLS already protects rows)

-- 8. Comments for documentation (updated 2026 cleanup)
COMMENT ON TABLE public.messages IS 'Transient Supabase table for realtime delivery only (auto-deleted after 1 day via pg_cron job). Permanent authoritative messages live in local Postgres `messages` table. Room identified by family_uuid + scope_type + small_family_id (no room_id column).';
COMMENT ON FUNCTION public.broadcast_new_message() IS 'Broadcasts new message via Supabase Broadcast (no service key needed). Payload does not include legacy room_id.';

-- After applying this migration (2026 cleanup):
-- - No more `room_id` anywhere in chat system.
-- - All code must use family_uuid + scope_type + small_family_id (users.uuid of husband for small rooms).
-- - Create daily sync / replication job from this table → local `messages` table (not the old chat_message_archive).
-- - pg_cron job "delete-old-family-chat-messages" (see 004_add_chat_messages_ttl_cleanup.sql) hard-deletes rows older than 1 day.
