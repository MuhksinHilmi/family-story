#!/usr/bin/env node

/**
 * scripts/backup-supabase.ts
 * - Run daily to backup messages from Supabase -> local Postgres
 * - Then soft-delete (set archived=true) messages that were backed up
 *
 * Usage: NODE_ENV=production SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... LOCAL_POSTGRES_URL=... node scripts/backup-supabase.js YYYY-MM-DD
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

const READ_BATCH = Number(process.env.BACKUP_READ_BATCH || 1000);
const DELETE_BATCH = Number(process.env.BACKUP_DELETE_BATCH || 500);
const BACKUP_GRACE_DAYS = Number(process.env.BACKUP_GRACE_DAYS || 3); // user chose 3

async function run() {
  const supabase = initSupabaseServer();
  const pg = new Client({ connectionString: process.env.LOCAL_POSTGRES_URL });
  await pg.connect();

  const targetArg = process.argv[2];
  const targetDate = targetArg ? dayjs.tz(targetArg, 'Asia/Jakarta') : dayjs().tz('Asia/Jakarta').subtract(1, 'day');
  const start = targetDate.startOf('day').toISOString();
  const end = targetDate.add(1, 'day').startOf('day').toISOString();
  const backupDate = targetDate.format('YYYY-MM-DD');

  console.log(`Backing up messages from ${start} to ${end} (WIB) as ${backupDate}`);

  const jobRes = await pg.query(
    'INSERT INTO backup_jobs(backup_date, started_at, status) VALUES($1, now(), $2) RETURNING id',
    [backupDate, 'RUNNING']
  );
  const jobId = jobRes.rows[0].id;

  let supabaseCount = 0;
  let localCount = 0;
  const backedUpIds: string[] = [];

  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .gte('created_at', start)
      .lt('created_at', end)
      .order('created_at', { ascending: true })
      .limit(READ_BATCH)
      .range(offset, offset + READ_BATCH - 1);

    if (error) {
      console.error('Supabase read error', error);
      await pg.query('UPDATE backup_jobs SET finished_at=now(), status=$1, error_text=$2 WHERE id=$3', ['FAILED', JSON.stringify(error), jobId]);
      await pg.end();
      return process.exit(1);
    }

    if (!data || data.length === 0) break;

    // upsert to local
    const values: any[] = [];
    const rows = data;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      values.push(r.id, r.room_id, r.user_id, JSON.stringify(r.content || null), r.type || null, r.created_at || null, r.edited_at || null, r.deleted || false, JSON.stringify(r.metadata || null), backupDate);
      backedUpIds.push(r.id);
    }

    const placeholders: string[] = [];
    for (let i = 0; i < rows.length; i++) {
      const base = i * 10;
      placeholders.push(`($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7},$${base + 8},$${base + 9},$${base + 10})`);
    }

    const upsertQuery = `INSERT INTO chat_message_archive(id, room_id, user_id, content, type, created_at, edited_at, deleted, metadata, backup_date)
      VALUES ${placeholders.join(',')}
      ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content, edited_at = EXCLUDED.edited_at, deleted = EXCLUDED.deleted, metadata = EXCLUDED.metadata`;

    try {
      await pg.query('BEGIN');
      await pg.query(upsertQuery, values);
      await pg.query('COMMIT');
      supabaseCount += rows.length;
    } catch (e) {
      await pg.query('ROLLBACK');
      console.error('PG upsert error', e);
      await pg.query('UPDATE backup_jobs SET finished_at=now(), status=$1, error_text=$2 WHERE id=$3', ['FAILED', JSON.stringify(e), jobId]);
      await pg.end();
      return process.exit(1);
    }

    // log chunk
    await pg.query('INSERT INTO backup_job_chunks(job_id, chunk_index, ids, status, processed_at) VALUES($1,$2,$3,$4,now())', [jobId, offset / READ_BATCH, JSON.stringify(rows.map((r: any) => r.id)), 'INSERTED']);

    offset += rows.length;
  }

  // finalize
  const cntRes = await pg.query('SELECT COUNT(1) as c FROM chat_message_archive WHERE backup_date=$1', [backupDate]);
  localCount = Number(cntRes.rows[0].c || 0);

  await pg.query('UPDATE backup_jobs SET finished_at=now(), status=$1, supabase_count=$2, local_count=$3 WHERE id=$4', ['COMPLETED', supabaseCount, localCount, jobId]);

  console.log(`Backup completed: supabase=${supabaseCount} local=${localCount}`);

  // verification
  if (supabaseCount !== localCount) {
    console.log('Mismatch counts, abort delete. Marking FAILED');
    await pg.query('UPDATE backup_jobs SET status=$1 WHERE id=$2', ['FAILED_VERIFY', jobId]);
    await pg.end();
    return process.exit(1);
  }

  // Soft-delete in supabase (archived=true)
  console.log('Starting soft-delete in Supabase by chunks...');
  for (let i = 0; i < backedUpIds.length; i += DELETE_BATCH) {
    const chunk = backedUpIds.slice(i, i + DELETE_BATCH);
    const { error } = await supabase.from('messages').update({ archived: true }).in('id', chunk);
    if (error) {
      console.error('Supabase update archived error', error);
      await pg.query('UPDATE backup_jobs SET status=$1, error_text=$2 WHERE id=$3', ['FAILED_DELETE', JSON.stringify(error), jobId]);
      await pg.end();
      return process.exit(1);
    }
    await pg.query('INSERT INTO backup_job_chunks(job_id, chunk_index, ids, status, processed_at) VALUES($1,$2,$3,$4,now())', [jobId, i / DELETE_BATCH, JSON.stringify(chunk), 'ARCHIVED']);
    console.log(`Archived chunk ${i / DELETE_BATCH}`);
  }

  await pg.query('UPDATE backup_jobs SET status=$1 WHERE id=$2', ['VERIFIED_AND_ARCHIVED', jobId]);

  console.log('All archived. Close PG.');
  await pg.end();
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
