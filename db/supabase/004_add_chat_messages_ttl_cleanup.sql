-- Supabase: TTL Cleanup Job for Transient Chat Messages (2026)
-- Purpose: Prevent Supabase `messages` table from growing unbounded.
--          Local Postgres `messages` remains the permanent source of truth.
--
-- Retention policy: Hard-delete rows older than 1 day (24 hours).
--                  This is sufficient for realtime delivery while keeping Supabase storage small.
--
-- How to apply:
--   1. Go to Supabase Dashboard → SQL Editor
--   2. Paste and run this entire file (or run via `supabase db query` / MCP)
--   3. Verify with: SELECT * FROM cron.job;
--
-- To change retention later, just reschedule with a new interval (e.g. '7 days').

-- 1. Enable pg_cron extension (idempotent)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Remove any previous job with the same name (safe re-apply)
DO $$
BEGIN
  PERFORM cron.unschedule('delete-old-family-chat-messages');
EXCEPTION WHEN OTHERS THEN
  -- Job did not exist yet — ignore
  NULL;
END $$;

-- 3. Schedule the cleanup job
--    Runs every hour at minute 0 (00:00, 01:00, 02:00, ...)
--    Deletes messages where created_at < now() - 1 day
SELECT cron.schedule(
  job_name  := 'delete-old-family-chat-messages',
  schedule  := '0 * * * *',
  command   := $$
    DELETE FROM public.messages
    WHERE created_at < (now() - INTERVAL '1 day');
  $$
);

-- 4. Optional: one-time manual cleanup (you can run this anytime)
-- DELETE FROM public.messages WHERE created_at < now() - INTERVAL '1 day';

-- 5. Verification queries (run these after applying)
-- SELECT * FROM cron.job WHERE jobname = 'delete-old-family-chat-messages';
-- SELECT count(*) AS remaining_messages, min(created_at) AS oldest FROM public.messages;

COMMENT ON TABLE public.messages IS
'Transient Supabase table for realtime delivery only (auto-deleted after 1 day via pg_cron).
 Permanent authoritative history lives in local Postgres `messages` table.';

-- Done. The job will now keep Supabase chat memory bounded automatically.
