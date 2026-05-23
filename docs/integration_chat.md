PRD Lengkap — Chat Keluarga (Realtime Supabase) + Local Sync Harian + Retensi 1 Hari di Supabase (pg_cron TTL)

## 2026 Final Architecture (Sudah Diimplementasikan)

**Local Postgres = Single Source of Truth (Permanent)**
- Tabel `messages` (bukan lagi `chat_message_archive`)
- Tabel `user_room_reads` (per-user last read cursor + unread_count)
- Semua history, unread badge, dan mark-read ada di sini

**Supabase `messages` = Transient Realtime Bus Only**
- Hanya untuk Broadcast (trigger) + delivery cepat
- Hard delete otomatis setelah 1 hari (24 jam) via pg_cron job `delete-old-family-chat-messages` (lihat db/supabase/004_...)
- Tidak lagi menjadi sumber history

**Send Flow (Local-First)**
1. Tulis ke local `messages` (langsung aman)
2. Tulis ke Supabase (untuk trigger realtime)
3. Client lain terima via Broadcast

**Load Flow di UI**
- Pertama buka / refresh room → ambil 50 pesan **terbaru** dari local DB (`?latest=true`)
- Realtime Broadcast menambahkan pesan baru di bawah
- "Muat pesan sebelumnya" tetap pakai cursor `before` ke local DB

**Room Identification**
- Tidak ada kolom `room_id` lagi di tabel `messages`
- Room diidentifikasi oleh: `family_uuid` + `scope_type` + `small_family_id` (users.uuid ayah)

**Unread / Read**
- `user_room_reads` (user_id + room_id) menyimpan `last_read_message_id` + `unread_count`
- `/api/chat/rooms` mengembalikan `unread_count` per room
- `POST /api/chat/mark-read` untuk update cursor

Status: Final & Sudah Berjalan (Mei 2026)

---

## PRD Asli (untuk referensi sejarah)
1) Ringkasan Produk
Aplikasi chat untuk keluarga menggunakan:

Supabase Postgres sebagai sumber pesan.
Supabase Realtime (Broadcast via trigger) untuk pesan baru.
Supabase auto-delete pesan lama setelah 1 hari (via pg_cron).
Local Postgres sebagai arsip jangka panjang (tidak ikut delete), yang disinkronkan dari Supabase via job sync harian “1 dump” untuk seluruh room sekaligus.
2) Problem yang Dipecahkan
Chat harus real-time untuk pesan baru.
Supabase tidak boleh menjadi “arsip permanen” karena biaya/retensi.
Saat pesan lama terhapus dari Supabase, user tetap bisa membaca history tersebut dari local.
Sync local harus:
meng-upgrade / update pesan baru,
tidak menghapus pesan lama yang sudah pernah masuk,
tidak duplikat walaupun sync dijalankan berulang.
3) Tujuan (Goals) & KPI
Goals
Pengiriman pesan real-time ke semua anggota keluarga dalam room yang sama.
History lama tetap tersedia melalui local walaupun Supabase sudah menghapus (H+3).
Local selalu “mengikuti” Supabase untuk pesan baru (sync daily 1 dump).
Tidak ada duplikasi message di UI (dedupe by id).
Akses data tetap aman berbasis family_id (RLS + Realtime Authorization).
KPI / Acceptance Criteria
Realtime: pesan baru muncul < 1–2 detik (indikatif).
Retensi: pesan >3 hari tidak lagi ada di Supabase, tetapi tetap tampil dari local.
Sync: setelah sync harian, local memiliki semua pesan yang masih ada di Supabase dalam window buffer.
Dedupe: 0 duplikasi pada tampilan chat ketika menggabungkan local+supabase+realtime.
4) Ruang Lingkup Fitur
In Scope (Phase ini)
Room: general + small (sesuai desain kamu).
Message: text only.
Realtime: pesan baru realtime.
Local sync: 1 dump harian, upsert idempotent, tidak delete.
UI:
bagian bawah (baru) dari Supabase
bagian atas (lama) dari local berbasis scroll anchor
Out of Scope (bisa fase berikutnya)
Edit message
Delete message by user
Attachment / media
Search full-text
Typing indicator
Presence
5) Model Domain & Skema Data (Konseptual)
Ikuti nama tabel/kolom yang kamu gunakan, tapi pastikan kolom kunci ada.

5.1 Room
Tabel chat_rooms (atau setara):

id (UUID, PK)
family_id (UUID)
scope_type (text/enum: 'general'|'small')
small_family_id (UUID, nullable — hanya jika scope small)
5.2 Message (Supabase)
Tabel messages:

id (UUID, PK) ✅ wajib stabil
room_id (UUID, FK)
family_id (UUID) (denormalisasi untuk RLS/perf)
scope_type (general/small)
sender_id (UUID)
sender_name_snapshot (text, optional tapi disarankan)
body (text)
created_at (timestamptz)
Index yang wajib
messages(room_id, created_at DESC)
messages(created_at) untuk delete cron dan window sync
5.3 Local Archive
Tabel local: messages_local

Struktur minimal sama dengan data yang dibutuhkan UI
id (UUID) sebagai PK/unique
kolom lain: room_id, family_id, scope_type, sender_id, sender_name_snapshot, body, created_at
6) Keamanan (Security Requirements)
6.1 Family-based Access Control
Akses SELECT/INSERT messages harus dibatasi oleh membership family_id.
Realtime Authorization juga harus menghormati family_id.
Prinsip:

User tidak boleh bisa join topic/channel yang bukan milik family mereka.
RLS harus mendukung query authorization yang efisien (pakai index).
6.2 Realtime Authorization (Broadcast)
Gunakan channel/topic private.
Implementasi mengikuti konsep Realtime Authorization: RLS policy di realtime.messages menentukan user boleh menerima broadcast untuk topic tersebut.
7) Realtime Design (Pesan Baru)
7.1 Mekanisme
Gunakan Broadcast dari database trigger.

Trigger: AFTER INSERT pada messages
Saat pesan masuk, server broadcast event “message_created” ke topic room/family.
7.2 Topic / Channel Convention (Deterministik)
Rekomendasi:

General:
family:<family_id>:general
Small:
family:<family_id>:small:<small_family_id>
7.3 Payload Event (Minimal)
Payload yang diperlukan UI dan dedupe:

id
room_id
family_id
scope_type
sender_id
sender_name_snapshot
body
created_at
7.4 Dedupe di Client
Client wajib:

simpan seenMessageIds (set) untuk session
saat event datang:
jika id belum ada → append
jika sudah ada → skip
8) Retensi & Auto-Delete di Supabase (H+3)
Requirement
Supabase akan menghapus pesan yang sudah lewat:

created_at < now() - interval '3 days'
Dampak ke UI
Untuk pesan > 3 hari:
Supabase tidak lagi mengembalikan
UI tetap harus mengambil dari local archive
9) Local Sync Requirements (Daily “1 Dump”)
9.1 Tujuan
Local selalu update pesan baru dari Supabase, lintas seluruh room, dengan cara:

1 dump harian (global, bukan per room)
upsert by id
tidak pernah delete di local
9.2 Kontrak Idempotent Sync
Local sync harus melakukan:

INSERT ... ON CONFLICT (id) DO UPDATE (atau DO NOTHING, tapi DO UPDATE lebih aman untuk snapshot/field berubah)
9.3 Window Sync Buffer
Karena delete terjadi di H+3, dan ada kemungkinan:

keterlambatan job
jitter waktu cron
penundaan update
Maka sync harian mengambil lebih luas dari cutoff:

contoh aturan aman:
created_at >= now() - interval '4 days'
Intinya: local akan tetap punya semua data yang mungkin akan terhapus di hari berikutnya, sehingga UI tidak gap.

9.4 Tidak Menghapus Data Lama di Local
Local sync tidak melakukan DELETE FROM messages_local ...
Jika Supabase delete terjadi, local tetap menyimpan arsip.
9.5 Catatan Operasional
Job harus bisa dijalankan ulang tanpa duplikasi (karena upsert by id).
Sinkronisasi bersifat eventually consistent; UI tetap dedupe.
10) UI/UX Requirements (Local + Supabase + Realtime)
10.1 Istilah
cutoff = now() - interval '3 days'
Local window = pesan yang lebih lama dari cutoff (arsip)
Supabase window = pesan terbaru (<=3 hari ke belakang)
10.2 Tampilan saat room dibuka
UI menampilkan gabungan:

Bagian Bawah / Baru: dari Supabase

Query: created_at >= cutoff
Ambil: 50 pesan terbaru
Urut tampilan: ascending
Bagian Atas / Lama: dari Local berbasis scroll anchor (pilihan kamu no.2)

UI menyimpan anchor_created_at:
nilai created_at dari item paling atas yang sudah ditampilkan/dipegang oleh user (atau saat komponen pertama kali “anchor” terbentuk)
Query local:
created_at < cutoff
dan created_at < anchor_created_at
ambil: 50 pesan
urutan pengambilan: ascending created_at
Urut tampilan: sesuai kebutuhan (umumnya ascending supaya urutan chat benar)
10.3 Saat user scroll ke atas (load berikutnya)
Update anchor_created_at ke created_at pesan teratas yang baru saja tampil.
Jalankan lagi query local dengan syarat created_at < anchor_created_at.
Ambil 50 batch berikutnya.
10.4 Saat user scroll ke bawah
Tambahkan pesan realtime atau batch dari Supabase:
realtime event untuk new message
jika perlu pagination, gunakan created_at > last_loaded_created_at dari Supabase
10.5 Dedupe di UI
Gabungkan local + supabase + realtime dengan dedupe id.
11) Integrasi (Endpoints/Jobs/Flows)
11.1 Flow “Kirim Message”
Client insert ke messages di Supabase
Trigger broadcast mem-push event ke topic room
Client lain menerima event dan append
Pengirim sendiri juga bisa menerima (opsional self config)
11.2 Flow “Sync Local Harian”
Jadwal daily (cron/runner)
Query Supabase (global dump):
ambil semua message yang created_at >= now()-4 days (atau nilai buffer yang kamu set)
Upsert ke messages_local berdasarkan id
Tidak delete
11.3 Flow “Load Chat Room”
Saat buka room:
Load local batch “atas/lama” berbasis anchor_created_at
Load Supabase batch “bawah/baru” (50 terbaru di >= cutoff)
Subscribe realtime topic sesuai room
Dedupe by id
12) Skema Kontrak Sync (Yang Harus Ada di Local)
Minimal local wajib punya:

PK/unique: id
Index:
(room_id, created_at) untuk query local cepat saat scroll
(family_id, created_at) jika UI sering filter family
13) Acceptance Test Plan
Test A — Realtime
Kirim message baru → pastikan semua anggota family yang open room menerima message tanpa duplicate.
Test B — Retensi Supabase
Tunggu message melewati H+3.
Pastikan:
Supabase tidak mengembalikan message tersebut
UI tetap menampilkan message dari local.
Test C — Local Sync Idempotency
Jalankan sync job 2x berturut-turut.
Pastikan tidak ada duplikasi data di local (COUNT(*) by id tetap unik).*
Test D — UI Dedupe
Kirim message saat user sedang membuka room dan batch local/supabase sudah ter-load.
Pastikan message yang masuk via realtime tidak dobel.
14) Risiko & Mitigasi
Gap karena job sync terlambat
Mitigasi: gunakan window buffer (mis. 4 days), dan upsert by id.
RLS/Reatime Authorization lambat
Mitigasi: index yang mendukung query RLS dan hindari join berat.
Duplikasi di UI
Mitigasi: dedupe by id selalu aktif.
Local database membesar
Mitigasi (opsional fase lanjut): kompresi/archiving, atau retention lokal per kebijakan.
15) Deliverables Teknis (Yang Harus Disiapkan)
Skema Supabase:
messages + index
chat_rooms + index seperlunya
RLS untuk messages (SELECT/INSERT) berbasis family_id
Trigger broadcast untuk realtime message_created ke topic deterministik
Cron/jadwal:
Supabase delete H+3
Local sync harian "1 dump"
Skema local:
messages_local + PK id dan index untuk room scroll
Client/UI logic:
menyimpan anchor_created_at
load local batch 50 (relatif anchor)
load supabase batch 50 (>= cutoff)
subscribe realtime dan dedupe by id

16) Implemented Endpoints (2026 Final)

- GET  /api/chat/rooms               → daftar room + unread_count per user
- GET  /api/chat/archive?room_id=...&latest=true → 50 pesan terbaru dari local DB
- GET  /api/chat/archive?room_id=...&before=...  → pesan lebih lama (pagination ke atas)
- POST /api/chat/send                → dual-write: local `messages` + Supabase (realtime)
- POST /api/chat/mark-read           → update last_read_message_id + reset unread_count
- GET  /api/chat/realtime            → (opsional) fetch recent dari Supabase langsung
- GET  /api/family/members

Catatan:
- Tidak ada lagi `room_id` di messages table.
- Local `messages` adalah sumber truth permanen.
- Supabase hanya untuk broadcast.
