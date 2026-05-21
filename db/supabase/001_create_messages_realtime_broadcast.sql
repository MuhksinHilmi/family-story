-- Supabase Migration: Chat messages table + Realtime Broadcast via trigger + Family RLS
-- Follows PRD integration_chat.md + current Supabase Broadcast from Database docs (2026)

-- 1. Core messages table (source of truth di Supabase, H+3 retention via cron)
-- All ID fields use UUID to match Supabase auth.uid() and client-generated UUIDs
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL,                      -- uses family_uuid for general, family_uuid+small for small rooms
  family_uuid UUID NOT NULL,                  -- main identifier for topics
  scope_type TEXT NOT NULL DEFAULT 'general' CHECK (scope_type IN ('general', 'small')),
  small_family_id UUID,                       -- UUID of father node for small rooms
  sender_id UUID NOT NULL,                    -- matches auth.uid() (UUID from users.uuid)
  sender_name_snapshot TEXT,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes required by PRD
CREATE INDEX IF NOT EXISTS idx_messages_room_created_at ON public.messages (room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages (created_at);
CREATE INDEX IF NOT EXISTS idx_messages_family_uuid_created_at ON public.messages (family_uuid, created_at);

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

  -- Broadcast custom payload (matches PRD section 7.3)
  PERFORM realtime.send(
    jsonb_build_object(
      'id', NEW.id,
      'room_id', NEW.room_id,
      'family_uuid', NEW.family_uuid,
      'scope_type', NEW.scope_type,
      'sender_id', NEW.sender_id,
      'sender_name_snapshot', NEW.sender_name_snapshot,
      'body', NEW.body,
      'created_at', NEW.created_at
    ),
    'message_created',   -- event name
    topic_name,
    true                 -- private channel (must match client config)
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

-- 8. Comments for documentation
COMMENT ON TABLE public.messages IS 'Chat messages (Supabase source of truth). Retained H+3 via separate cron job. Broadcast to family rooms via DB trigger.';
COMMENT ON FUNCTION public.broadcast_new_message() IS 'Sends realtime broadcast on new message using Supabase Broadcast from Database (no service key required in app code).';

-- After applying this migration:
-- 1. Run: supabase db advisors (or MCP get_advisors)
-- 2. Verify RLS with RLS Tester in dashboard
-- 3. Test with real family member JWT
-- 4. Create daily sync job that upserts from messages (created_at >= now()-4 days) into chat_message_archive
-- 5. Add cron for H+3 deletion on messages (created_at < now()-3 days) if not using pg_cron yet
