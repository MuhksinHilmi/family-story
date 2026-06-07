# Family Story

Aplikasi silsilah keluarga + Chat realtime keluarga (Supabase Realtime + Local Archive).

## Tech Stack

- **Backend**: Next.js (App Router) + API Routes
- **Database**:
  - Local PostgreSQL (family tree, users, chat archive)
  - Supabase PostgreSQL (chat messages + Realtime Broadcast)
- **Realtime**: Supabase Realtime (Broadcast via database trigger)
- **Auth**: Custom JWT + local users table

## Folder Structure (SQL)

Semua SQL sekarang terpusat di folder `db/` agar mudah di-deploy ke VPS:

```
db/
├── init.sql                          # Full schema untuk fresh install (run sekali)
├── migrations/
│   ├── 001_create_chat_archive.sql   # Chat archive + backup jobs
│   └── 002_create_chat_rooms.sql     # UUID chat rooms (linked to families)
└── supabase/
    └── 001_create_messages_realtime_broadcast.sql   # Jalankan manual di Supabase Dashboard
```

**Penting**: 
- `db/init.sql` = semua tabel saat ini (bisa dijalankan di VPS baru).
- File di `migrations/` hanya untuk perubahan incremental setelah `init.sql`.

---

## Local Development Setup

1. Clone repo
2. Install dependencies
   ```bash
   npm install
   ```
3. Buat database lokal
   ```bash
   createdb family_story
   ```
4. Jalankan schema
   ```bash
   psql -d family_story -f db/init.sql
   ```
5. Copy environment
   ```bash
   cp .env.example .env.local
   ```
6. Isi `.env.local` (minimal):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` atau `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SECRET_KEY` (atau `SUPABASE_SERVICE_ROLE_KEY`)
   - Database credentials (`DB_HOST`, `DB_PORT`, dll) jika pakai connection string
7. Jalankan app
   ```bash
   npm run dev
   ```

---

## Setup di VPS (Production)

### 1. Persiapan Server

```bash
# Install Postgres (Ubuntu/Debian)
sudo apt update
sudo apt install postgresql postgresql-contrib

# Buat database & user
sudo -u postgres psql
```

Di dalam psql:
```sql
CREATE DATABASE family_story;
CREATE USER family_user WITH ENCRYPTED PASSWORD 'your_strong_password';
GRANT ALL PRIVILEGES ON DATABASE family_story TO family_user;
\q
```

### 2. Deploy Kode & Jalankan Schema

```bash
# Clone repo ke server
git clone <your-repo> /var/www/family-story
cd /var/www/family-story

# Install dependencies
npm ci --production

# Jalankan schema (hanya sekali di VPS baru)
psql -d family_story -U family_user -f db/init.sql
```

### 3. Environment Variables

Buat file `/var/www/family-story/.env.local` (atau gunakan PM2 ecosystem).

Isi minimal:

```bash
NODE_ENV=production
NEXT_PUBLIC_SITE_URL=https://yourdomain.com

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...

# Local Postgres
DB_HOST=localhost
DB_PORT=5432
DB_NAME=family_story
DB_USER=family_user
DB_PASSWORD=your_strong_password

# JWT (untuk custom auth)
JWT_SECRET=super-long-random-string-here
JWT_EXPIRES_IN=7d
```

### 4. Jalankan Aplikasi

Gunakan PM2 (recommended):

```bash
npm install -g pm2
pm2 start npm --name "family-story" -- run start
pm2 save
pm2 startup
```

Atau pakai Docker + docker-compose (lebih bersih untuk production).

### 5. Supabase Setup (Wajib untuk Chat Realtime)

1. Buat project baru di https://supabase.com
2. Copy credentials ke `.env.local`
3. Buka **SQL Editor** di Supabase Dashboard
4. Copy-paste seluruh isi file:
   ```
   db/supabase/001_create_messages_realtime_broadcast.sql
   ```
5. Run query

**Penting**: 
- Chat messages disimpan di Supabase (realtime).
- Data lama dihapus otomatis H+3 di Supabase.
- Local DB hanya menyimpan arsip jangka panjang via daily sync job.

---

## Chat Realtime Architecture (Ringkas)

- **Supabase `messages`** → source of truth + Realtime Broadcast via trigger (`AFTER INSERT`)
- **Local `chat_message_archive`** + `chat_rooms` → arsip permanen
- **Daily job** (masih dalam pengembangan) → sync 1x sehari dari Supabase ke local (window 4 hari)
- **Topic format**: `family:<family_id>:general`

---

## Useful Commands

```bash
# Reset local DB (hati-hati!)
psql -d family_story -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
psql -d family_story -f db/init.sql

# Cek migration yang sudah jalan
psql -d family_story -c "\dt chat_rooms"
psql -d family_story -c "\dt chat_message_archive"

# Jalankan hanya migration baru (setelah init)
psql -d family_story -f db/migrations/002_create_chat_rooms.sql
```

---

## Catatan Penting

- Jangan ubah `src/lib/schema.sql` lagi. Semua perubahan sekarang lewat `db/`.
- Core family tree (`family_nodes`, `spouse_relations`, dll) masih pakai `INTEGER` ID karena sudah stabil.
- Hanya chat yang pakai `UUID` (room & message) agar cocok dengan Supabase Realtime.
- Saat deploy VPS baru, cukup jalankan `db/init.sql` sekali saja.

---

## Next Steps (Development)

- Daily sync job (Supabase → local archive)
- H+3 auto delete cron di Supabase
- Improve RLS policy di Supabase (saat ini masih permissive untuk development)
- UI improvement untuk chat (scroll anchor, sender name, dll)

---

MAIL Local:
npx maildev --web 8025 --smtp 1025
