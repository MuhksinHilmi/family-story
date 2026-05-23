#!/usr/bin/env node

/**
 * scripts/backup-supabase.ts
 *
 * Daily (or on-demand) replication from Supabase `messages` (transient, H+3)
 * into local Postgres `messages` table (permanent authoritative store).
 *
 * This script is the safety net so that:
 *   - Refreshing the chat page always shows history (even after Supabase deletes old rows)
 *   - New family members can see past messages
 *   - We have a durable backup independent of Supabase retention
 *
 * IMPORTANT (2026 architecture):
 *   - No more `room_id`. Room is identified by (family_uuid + scope_type + small_family_id)
 *   - Target table = `messages` (created in migration 011), NOT the legacy `chat_message_archive`
 *   - Supabase hard-deletes messages older than 1 day via pg_cron job (see db/supabase/004_add_chat_messages_ttl_cleanup.sql)
 *   - This script only does UPSERT (never deletes from local)
 *
 * Usage:
 *   node scripts/backup-supabase.ts [YYYY-MM-DD]
 *
 * Environment variables required:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, LOCAL_POSTGRES_URL
 *
 * Recommended schedule: once per day (e.g. 01:00 WIB) via cron / GitHub Actions / etc.
 */

import { initSupabaseServer } from '../src/lib/supabase-server';
import { Client } from 'pg';
import dotenv from 'dotenv';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dotenv.config();

dayjs.extend(utc);
dayjs.extend(timezone);

const READ_BATCH = Number(process.env.BACKUP_READ_BATCH || 2000);
const WINDOW_DAYS = Number(process.env.BACKUP_WINDOW_DAYS || 5); // pull last N days to avoid gaps

interface SupabaseMessage {
  id: string;
  family_uuid: string;
  scope_type: 'general' | 'small';
  small_family_id: string | null;
  sender_id: string;
  sender_name_snapshot: string | null;
  sender_photo_snapshot: string | null;
  body: string;
  type?: string;
  media_url?: string | null;
  media_mime_type?: string | null;
  media_size_bytes?: number | null;
  thumbnail_url?: string | null;
  created_at: string;
  deleted?: boolean;
}

async function run() {
  const supabase = initSupabaseServer();
  const pg = new Client({ connectionString: process.env.LOCAL_POSTGRES_URL });
  await pg.connect();

  const targetArg = process.argv[2];
  const baseDate = targetArg
    ? dayjs.tz(targetArg, 'Asia/Jakarta')
    : dayjs().tz('Asia/Jakarta');

  // Pull a safe window (e.g. last 5 days) so we never miss messages due to timing jitter
  const start = baseDate.subtract(WINDOW_DAYS, 'day').startOf('day').toISOString();
  const end = baseDate.endOf('day').toISOString();
  const runDate = baseDate.format('YYYY-MM-DD');

  console.log(`[Backup] Replicating Supabase messages → local "messages" table`);
  console.log(`[Backup] Window: ${start} → ${end} (WIB)  |  Run date: ${runDate}`);

  // Create / update job record
  const jobRes = await pg.query(
    `INSERT INTO backup_jobs(backup_date, started_at, status)
     VALUES($1, now(), 'RUNNING') RETURNING id`,
    [runDate]
  );
  const jobId = jobRes.rows[0].id;

  let totalProcessed = 0;
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from('messages')
      .select(`
        id, family_uuid, scope_type, small_family_id,
        sender_id, sender_name_snapshot, sender_photo_snapshot,
        body, type, media_url, media_mime_type, media_size_bytes, thumbnail_url,
        created_at, deleted
      `)
      .gte('created_at', start)
      .lt('created_at', end)
      .order('created_at', { ascending: true })
      .range(offset, offset + READ_BATCH - 1);

    if (error) {
      console.error('[Backup] Supabase read error:', error);
      await pg.query(
        'UPDATE backup_jobs SET finished_at=now(), status=$1, error_text=$2 WHERE id=$3',
        ['FAILED', JSON.stringify(error), jobId]
      );
      await pg.end();
      process.exit(1);
    }

    if (!data || data.length === 0) break;

    const rows: SupabaseMessage[] = data;

    // Build bulk upsert for the new `messages` table
    const columns = [
      'id', 'family_uuid', 'scope_type', 'small_family_id',
      'sender_id', 'sender_name_snapshot', 'sender_photo_snapshot',
      'body', 'type', 'media_url', 'media_mime_type', 'media_size_bytes',
      'thumbnail_url', 'created_at', 'deleted'
    ];

    const values: any[] = [];
    const placeholders: string[] = [];

    rows.forEach((r, i) => {
      const base = i * columns.length;

      values.push(
        r.id,
        r.family_uuid,
        r.scope_type,
        r.small_family_id,
        r.sender_id,
        r.sender_name_snapshot,
        r.sender_photo_snapshot,
        r.body,
        r.type || 'text',
        r.media_url || null,
        r.media_mime_type || null,
        r.media_size_bytes || null,
        r.thumbnail_url || null,
        r.created_at,
        r.deleted ?? false
      );

      const ph = columns.map((_, j) => `$${base + j + 1}`).join(',');
      placeholders.push(`(${ph})`);
    });

    const upsertSql = `
      INSERT INTO messages (${columns.join(',')})
      VALUES ${placeholders.join(',')}
      ON CONFLICT (id) DO UPDATE SET
        sender_name_snapshot = EXCLUDED.sender_name_snapshot,
        sender_photo_snapshot = EXCLUDED.sender_photo_snapshot,
        body = EXCLUDED.body,
        type = EXCLUDED.type,
        media_url = EXCLUDED.media_url,
        media_mime_type = EXCLUDED.media_mime_type,
        media_size_bytes = EXCLUDED.media_size_bytes,
        thumbnail_url = EXCLUDED.thumbnail_url,
        deleted = EXCLUDED.deleted
    `;

    try {
      await pg.query('BEGIN');
      await pg.query(upsertSql, values);
      await pg.query('COMMIT');

      totalProcessed += rows.length;
      console.log(`[Backup] Upserted chunk: ${rows.length} messages (offset ${offset})`);
    } catch (e: any) {
      await pg.query('ROLLBACK');
      console.error('[Backup] Local Postgres upsert error:', e);
      await pg.query(
        'UPDATE backup_jobs SET finished_at=now(), status=$1, error_text=$2 WHERE id=$3',
        ['FAILED', e.message || JSON.stringify(e), jobId]
      );
      await pg.end();
      process.exit(1);
    }

    // Log chunk for audit
    await pg.query(
      `INSERT INTO backup_job_chunks(job_id, chunk_index, ids, status, processed_at)
       VALUES($1, $2, $3, 'UPSERTED', now())`,
      [jobId, Math.floor(offset / READ_BATCH), JSON.stringify(rows.map(r => r.id))]
    );

    offset += rows.length;
  }

  // Finalize job
  await pg.query(
    `UPDATE backup_jobs
     SET finished_at = now(),
         status = 'COMPLETED',
         supabase_count = $1,
         local_count = $1
     WHERE id = $2`,
    [totalProcessed, jobId]
  );

  console.log(`[Backup] SUCCESS — ${totalProcessed} messages replicated to local "messages" table.`);
  console.log('[Backup] Supabase old rows will be auto-deleted by its own H+3 cron (local keeps everything).');

  await pg.end();
  process.exit(0);
}

run().catch(async (e) => {
  console.error('[Backup] Fatal error:', e);
  process.exit(1);
});
