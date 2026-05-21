import { createClient } from '@supabase/supabase-js';

export function initSupabaseServer() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase server env vars missing (SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY required)');
  return createClient(url, key);
}
