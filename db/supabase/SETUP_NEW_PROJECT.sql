-- ============================================================
-- CERITA KELUARGA — Supabase New Project Setup
-- ============================================================
-- Jalankan file ini SEKALI di Supabase Dashboard → SQL Editor.
-- Aman untuk dijalankan ulang (semua pakai IF NOT EXISTS / OR REPLACE).
--
-- Arsitektur:
--   - App pakai custom JWT auth (bukan Supabase Auth)
--   - Server mint "Supabase-compatible JWT" via /api/chat/realtime-token
--     → di-sign dengan SUPABASE_JWT_SECRET (HS256 legacy secret)
--     → berisi claim family_uuids:[...] untuk RLS
--   - Client pakai token ini untuk setAuth() sebelum subscribe
--   - Channel PRIVATE → Supabase verifikasi JWT + jalankan RLS
--   - RLS cek family_uuids dari JWT claim, bukan query tabel
--     (lebih cepat, tidak ada N+1 ke family_members)
--   - public.messages hanya transient — auto-delete 7 hari via pg_cron
--
-- Yang dibuat:
--   1. public.family_members   (opsional, untuk fallback RLS)
--   2. public.messages         (transient realtime bus, 7-hari TTL)
--   3. Helper functions        (claim extraction, topic parsing)
--   4. RLS policies messages   (INSERT/SELECT berbasis family_uuids claim)
--   5. RLS policies realtime   (Broadcast auth berbasis family_uuids claim)
--   6. Trigger broadcast       (INSERT → realtime.send private)
--   7. pg_cron TTL 7 hari
--   8. Grants
-- ============================================================


-- ──────────────────────────────────────────────────────────────
-- BAGIAN 1: public.family_members
-- Opsional — dipakai sebagai fallback jika claim tidak ada.
-- Diisi oleh sync job dari local Postgres.
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.family_members (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_uuid UUID        NOT NULL,
  user_id     UUID        NOT NULL,
  role        VARCHAR(20) NOT NULL DEFAULT 'member'
                          CHECK (role IN ('admin', 'member')),
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (family_uuid, user_id)
);

CREATE INDEX IF NOT EXISTS idx_fm_user_id     ON public.family_members (user_id);
CREATE INDEX IF NOT EXISTS idx_fm_family_uuid ON public.family_members (family_uuid);

ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_can_view_own_membership" ON public.family_members;
CREATE POLICY "users_can_view_own_membership"
  ON public.family_members
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));


-- ──────────────────────────────────────────────────────────────
-- BAGIAN 2: public.messages
-- Transient realtime bus — bukan storage permanen.
-- Permanent history: local Postgres messages table.
-- Room diidentifikasi: family_uuid + scope_type + small_family_id
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.messages (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_uuid           UUID        NOT NULL,
  scope_type            TEXT        NOT NULL DEFAULT 'general'
                                    CHECK (scope_type IN ('general', 'small')),
  small_family_id       UUID,
  sender_id             UUID        NOT NULL,
  sender_name_snapshot  TEXT,
  sender_photo_snapshot TEXT,
  body                  TEXT        NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_msg_created_at
  ON public.messages (created_at);
CREATE INDEX IF NOT EXISTS idx_msg_family_created
  ON public.messages (family_uuid, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_msg_composite
  ON public.messages (family_uuid, scope_type, small_family_id, created_at DESC);

COMMENT ON TABLE public.messages IS
  'Transient Supabase table — realtime delivery bus only. '
  'Auto-deleted setelah 7 hari via pg_cron. '
  'Permanent history: local Postgres messages table.';


-- ──────────────────────────────────────────────────────────────
-- BAGIAN 3: Helper functions
-- ──────────────────────────────────────────────────────────────

-- Ekstrak family_uuid dari topic string
-- Format topic: family:{uuid}:general  atau  family:{uuid}:small:{id}
CREATE OR REPLACE FUNCTION public.extract_family_uuid_from_topic()
RETURNS UUID
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN realtime.topic() LIKE 'family:%:general'
      OR realtime.topic() LIKE 'family:%:small:%'
    THEN (split_part(realtime.topic(), ':', 2))::uuid
    ELSE NULL
  END;
$$;

-- Cek apakah family_uuid ada di dalam array claim family_uuids di JWT
-- JWT claim: { family_uuids: ["uuid1", "uuid2", ...] }
CREATE OR REPLACE FUNCTION public.jwt_has_family_access(p_family_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM jsonb_array_elements_text(
      COALESCE(
        (auth.jwt() -> 'family_uuids'),
        '[]'::jsonb
      )
    ) AS elem
    WHERE elem::uuid = p_family_uuid
  );
$$;

COMMENT ON FUNCTION public.jwt_has_family_access IS
  'Cek apakah JWT aktif memiliki akses ke family_uuid tertentu '
  'via custom claim family_uuids. Dipakai di RLS policies.';


-- ──────────────────────────────────────────────────────────────
-- BAGIAN 4: RLS pada public.messages
-- Berbasis JWT claim family_uuids — tidak query tabel, lebih cepat.
-- ──────────────────────────────────────────────────────────────

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_family_can_insert_messages"  ON public.messages;
DROP POLICY IF EXISTS "jwt_family_can_select_messages"  ON public.messages;
DROP POLICY IF EXISTS "family_members_can_insert_messages" ON public.messages;
DROP POLICY IF EXISTS "family_members_can_select_messages" ON public.messages;

CREATE POLICY "jwt_family_can_insert_messages"
  ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    public.jwt_has_family_access(family_uuid)
  );

CREATE POLICY "jwt_family_can_select_messages"
  ON public.messages
  FOR SELECT TO authenticated
  USING (
    public.jwt_has_family_access(family_uuid)
  );


-- ──────────────────────────────────────────────────────────────
-- BAGIAN 5: RLS pada realtime.messages (Broadcast authorization)
-- Channel PRIVATE → Supabase verifikasi JWT sebelum izinkan subscribe.
-- Cek via tabel family_members (diisi sync dari local DB).
-- auth.uid() = sub claim dari JWT yang kita mint di /api/chat/realtime-token
-- ──────────────────────────────────────────────────────────────

-- Receive broadcast: izinkan jika user ada di family_members
-- yang family_uuid-nya cocok dengan topic
DROP POLICY IF EXISTS "jwt_family_can_receive_broadcasts" ON realtime.messages;
DROP POLICY IF EXISTS "family_members_can_receive_broadcasts" ON realtime.messages;
DROP POLICY IF EXISTS "anon_can_receive_broadcasts" ON realtime.messages;
CREATE POLICY "jwt_family_can_receive_broadcasts"
  ON realtime.messages
  FOR SELECT TO authenticated
  USING (
    extension = 'broadcast'
    AND public.extract_family_uuid_from_topic() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.family_members fm
      WHERE fm.family_uuid = public.extract_family_uuid_from_topic()
        AND fm.user_id = (SELECT auth.uid())
    )
  );

-- Blok send langsung dari client
DROP POLICY IF EXISTS "block_direct_client_broadcast"        ON realtime.messages;
DROP POLICY IF EXISTS "family_members_can_send_broadcasts"   ON realtime.messages;
DROP POLICY IF EXISTS "anon_can_send_broadcasts"             ON realtime.messages;
CREATE POLICY "block_direct_client_broadcast"
  ON realtime.messages
  FOR INSERT TO authenticated
  WITH CHECK (false);


-- ──────────────────────────────────────────────────────────────
-- BAGIAN 6: Trigger broadcast_new_message
-- AFTER INSERT on public.messages → realtime.send() private channel
-- Trigger berjalan sebagai SECURITY DEFINER (bypass RLS) sehingga
-- bisa send ke private channel tanpa JWT.
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.broadcast_new_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_topic TEXT;
BEGIN
  -- Bangun topic sesuai format yang di-subscribe frontend
  IF NEW.scope_type = 'general' THEN
    v_topic := 'family:' || NEW.family_uuid::text || ':general';
  ELSE
    v_topic := 'family:' || NEW.family_uuid::text
                         || ':small:'
                         || COALESCE(NEW.small_family_id::text, '');
  END IF;

  -- Broadcast ke channel PRIVATE (true)
  -- Hanya subscriber yang JWT-nya lulus RLS yang akan menerima
  PERFORM realtime.send(
    jsonb_build_object(
      'id',                    NEW.id,
      'family_uuid',           NEW.family_uuid,
      'scope_type',            NEW.scope_type,
      'small_family_id',       NEW.small_family_id,
      'sender_id',             NEW.sender_id,
      'sender_name_snapshot',  NEW.sender_name_snapshot,
      'sender_photo_snapshot', NEW.sender_photo_snapshot,
      'body',                  NEW.body,
      'created_at',            NEW.created_at
    ),
    'message_created',
    v_topic,
    true   -- PRIVATE: Supabase enforce RLS sebelum deliver ke subscriber
  );

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.broadcast_new_message() IS
  'Broadcasts new chat message via Supabase Realtime Broadcast (private channel). '
  'Berjalan AFTER INSERT on public.messages. '
  'SECURITY DEFINER agar bisa send ke private channel tanpa JWT.';

DROP TRIGGER IF EXISTS messages_broadcast_trigger ON public.messages;

CREATE TRIGGER messages_broadcast_trigger
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.broadcast_new_message();


-- ──────────────────────────────────────────────────────────────
-- BAGIAN 7: pg_cron TTL cleanup — 7 hari
-- ──────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Hapus job lama kalau ada (safe re-apply)
DO $$
BEGIN
  PERFORM cron.unschedule('delete-old-family-chat-messages');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Cleanup harian jam 02:00 UTC — hapus pesan > 7 hari
SELECT cron.schedule(
  'delete-old-family-chat-messages',
  '0 2 * * *',
  $$
    DELETE FROM public.messages
    WHERE created_at < (now() - INTERVAL '7 days');
  $$
);


-- ──────────────────────────────────────────────────────────────
-- BAGIAN 8: Grants
-- service_role bypass RLS otomatis — tidak perlu di-grant.
-- authenticated = user yang sudah setAuth() dengan realtime token.
-- ──────────────────────────────────────────────────────────────

-- Tabel messages: authenticated bisa select (untuk debug/history jika perlu)
-- Insert hanya lewat server (service_role), bukan client langsung
GRANT SELECT ON public.messages        TO authenticated;
GRANT SELECT ON public.family_members  TO authenticated;

-- Helper functions
GRANT EXECUTE ON FUNCTION public.extract_family_uuid_from_topic() TO authenticated;
GRANT EXECUTE ON FUNCTION public.jwt_has_family_access(UUID)      TO authenticated;


-- ──────────────────────────────────────────────────────────────
-- SELESAI — Checklist setelah apply
-- ──────────────────────────────────────────────────────────────
--
-- [ ] 1. Supabase Dashboard → Settings → JWT Keys → Legacy JWT Secret
--        Salin nilai secret → tambahkan ke .env.local:
--        SUPABASE_JWT_SECRET=<nilai dari dashboard>
--
-- [ ] 2. Supabase Dashboard → Settings → API
--        Salin ke .env.local:
--        NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
--        NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
--        SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
--
-- [ ] 3. Supabase Dashboard → Realtime
--        Pastikan Realtime enabled untuk table messages.
--
-- [ ] 4. Test flow:
--        - Buka /chat, cek console: "[Realtime] ... → status: SUBSCRIBED"
--        - Kirim pesan, cek apakah muncul realtime di tab lain
--
-- [ ] 5. (Opsional) Isi family_members untuk testing manual:
--        INSERT INTO public.family_members (family_uuid, user_id)
--        VALUES ('uuid-keluarga'::uuid, 'user-uuid'::uuid);
--
-- Verifikasi pg_cron:
--   SELECT jobname, schedule, active FROM cron.job
--   WHERE jobname = 'delete-old-family-chat-messages';
-- ──────────────────────────────────────────────────────────────
