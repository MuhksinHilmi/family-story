# Ta'aruf — Master Planning Document
**CeritaKeluarga · September 2026**  
**Status:** Draft final — siap review sebelum implementasi

---

## Daftar Isi

1. [Visi & Pembeda](#1-visi--pembeda)
2. [Syarat Akses](#2-syarat-akses)
3. [Sistem Wali](#3-sistem-wali)
4. [Onboarding — Wajib Sebelum Browse](#4-onboarding--wajib-sebelum-browse)
5. [Personality Test](#5-personality-test)
6. [Browsing & Limit](#6-browsing--limit)
7. [Alur Lengkap & State Machine](#7-alur-lengkap--state-machine)
8. [Chat Pengenalan Keluarga](#8-chat-pengenalan-keluarga)
9. [Invitation Serius & Konfirmasi Final](#9-invitation-serius--konfirmasi-final)
10. [Schema Database](#10-schema-database)
11. [API Endpoints](#11-api-endpoints)
12. [Algoritma Resolve Wali](#12-algoritma-resolve-wali)
13. [Algoritma Compatibility Score](#13-algoritma-compatibility-score)
14. [Cron Jobs](#14-cron-jobs)
15. [UI Screens](#15-ui-screens)
16. [Sprint Plan](#16-sprint-plan)
17. [Yang Sudah Diimplementasi (Legacy)](#17-yang-sudah-diimplementasi-legacy)
18. [Perubahan dari Implementasi Lama](#18-perubahan-dari-implementasi-lama)
19. [Pending](#19-pending)

---

## 1. Visi & Pembeda

Ta'aruf di CeritaKeluarga bukan dating app. Ini adalah proses pengenalan terstruktur yang:

- **Melibatkan keluarga inti dari kedua pihak sejak awal** — bukan hanya saat lamaran
- **Berbasis sistem wali** yang dicari otomatis dari pohon silsilah keluarga sesuai urutan fiqih
- **Menjaga adab** — kedua calon tidak pernah berdua tanpa keluarga di chat
- **Berbasis kompatibilitas kepribadian** (Hybrid Big Five + konteks Islam) bukan sekadar penampilan
- **Transparan** — profil orang tua, hobi, kondisi kesehatan (opsional) semua bisa ditampilkan
- **Bersifat sementara** sampai ada keputusan — chat pengenalan auto-expired, tidak menggantung

---

## 2. Syarat Akses

User bisa akses ta'aruf jika memenuhi semua:

| Syarat | Sumber data |
|---|---|
| Usia ≥ 18 tahun | `nodes.birth_date` |
| Belum punya spouse aktif | `marriages.status = 'married'` |
| Profil ta'aruf lengkap + test selesai | `taaruf_profiles.onboarding_step = 4` |
| Wali sudah dikonfirmasi | `taaruf_profiles.wali_confirmed_at IS NOT NULL` |
| Tidak sedang `in_process` | `taaruf_profiles.status != 'in_process'` |

---

## 3. Sistem Wali

### 3.1 Hierarki Pencarian Otomatis (Urutan Fiqih Standar)

Sistem traverse pohon keluarga secara otomatis. Semua yang ditemukan pasti sudah punya akun karena terhubung via pohon keluarga.

```
1. Ayah kandung
2. Kakek dari jalur ayah (ayah dari ayah)
3. Saudara laki-laki kandung (seayah seibu)
4. Saudara laki-laki seayah (beda ibu)
5. Anak laki-laki dari saudara kandung (keponakan laki-laki)
6. Paman dari jalur ayah (saudara laki-laki ayah)
```

### 3.2 Jika Tidak Ada di Pohon

**Langkah 1 — Request ke user platform:**
User memilih sendiri seseorang yang terdaftar di platform (teman, kenalan).
- Sistem kirim notifikasi ke orang tersebut
- Orang tersebut Accept / Decline
- User bisa tulis pesan penjelasan saat request

**Langkah 2 — Wali administrasi eksternal:**
Jika tidak ada satupun di platform:
- User input: nama + nomor HP/email wali
- Tidak punya akun, tidak ada akses sistem
- Approval dilakukan di luar platform
- User klik "Konfirmasi Wali Sudah Setuju"
- Platform catat dengan flag `wali_type = 'external'`
- Proses ta'aruf tetap berjalan

### 3.3 Ganti Wali

Wali **bisa diganti di tengah proses** jika:
- Wali meninggal dunia
- Wali tidak aktif / tidak bisa dihubungi
- Wali mengundurkan diri

Caranya sama dengan setup awal — sistem cari otomatis dari hierarki berikutnya, atau user request manual. Koneksi yang sedang berjalan tidak terganggu selama wali baru sudah dikonfirmasi dalam 3 hari.

### 3.4 Peran Wali per Tahap

| Tahap | Wali Pria | Wali Wanita |
|---|---|---|
| Kirim CV | Notifikasi saja | — |
| CV masuk | — | **Approve / Decline** |
| Intro chat aktif | Anggota room, bisa chat | Anggota room, bisa chat |
| Invitation serius | **Approve** sebelum terkirim | **Approve / Decline** |
| Konfirmasi final | **Konfirmasi** | **Konfirmasi** |

---

## 4. Onboarding — Wajib Sebelum Browse

User tidak bisa langsung browse. Harus melewati 4 tahap berurutan yang dicatat di `onboarding_step`:

```
Step 0: Layar Penjelasan Fitur
        ↓
Step 1: Personality Test (30 pertanyaan)
        ↓
Step 2: Isi Biodata Lengkap (4 tab)
        ↓
Step 3: Setup Wali
        ↓
Step 4: [BISA BROWSE]
```

### Step 0 — Layar Penjelasan Fitur

Sebelum apapun, user membaca penjelasan yang mencakup:
- Apa itu ta'aruf dan perbedaannya dengan dating app
- Bagaimana keluarga dilibatkan dari awal
- Prinsip "tidak berdua" — selalu ada wali/keluarga di chat
- Chat pengenalan bersifat sementara (2 minggu, bisa extend 1x)
- Komitmen yang diharapkan — bukan untuk iseng

Tombol "Saya Mengerti & Siap Memulai" baru aktif setelah scroll sampai bawah.

### Step 1 — Personality Test

Lihat detail di [Bagian 5](#5-personality-test).

### Step 2 — Biodata Lengkap (4 Tab)

**Tab 1 — Profil Pribadi:**
- Nama (auto dari `nodes.full_name`, readonly)
- Usia (auto dari `nodes.birth_date`, readonly)
- Foto profil (upload)
- Kota domisili
- Pendidikan terakhir
- Pekerjaan / profesi
- Tentang diri (min 100 karakter)
- Hobi & minat (multi-select chips, min 3)

**Tab 2 — Profil Orang Tua:**

Data di-pull otomatis dari `parent_child_relations → nodes → users`.

Yang ditampilkan:
- Nama ayah & ibu
- Pekerjaan ayah & ibu (dari `nodes.occupation`)
- Kota domisili keluarga
- Hobi/minat ayah & ibu (dari `nodes.interests` jika ada)

User bisa tambahkan manual jika orang tua tidak ada di pohon atau info kurang lengkap.

> *Catatan UI: "Info profil orang tua hanya ditampilkan ke calon setelah CV diterima."*

**Tab 3 — Kondisi Kesehatan (Opsional):**
- Toggle on/off
- Jika on: textarea bebas (user ceritakan dengan bahasa sendiri)
- Prompt: *"Misalnya kondisi genetik, alergi, kondisi kronis. Hanya untuk transparansi."*
- Visible hanya setelah CV diterima, tidak muncul di profil publik

**Tab 4 — Kriteria Pasangan:**
- Rentang usia (range slider)
- Kota/wilayah yang diinginkan
- Pendidikan minimum
- Status pernikahan calon (belum menikah / janda/duda)
- Catatan tambahan (opsional)

### Step 3 — Setup Wali

Sistem cari otomatis dari pohon keluarga. Tampilkan hasilnya ke user:
- "Kami menemukan wali untuk kamu: [nama], [relasi]"
- User konfirmasi → kirim notifikasi ke wali
- Wali accept → setup selesai

Jika tidak ditemukan:
- Tampil form request ke user platform
- Atau input wali administrasi eksternal

---

## 5. Personality Test

### 5.1 Pendekatan

**Hybrid Big Five + Konteks Islam:**
Big Five (OCEAN) sebagai backbone ilmiah, pertanyaan dikemas dengan konteks kehidupan sehari-hari Muslim. Bukan pertanyaan psikologi generik.

Total: **30 pertanyaan** (6 per dimensi), skala Likert 1–5, estimasi 10–15 menit.

**Update:** Bisa diulang setelah **6 bulan** dari test terakhir.
Jika diupdate, compatibility score dengan koneksi aktif di-recalculate.

### 5.2 Pertanyaan per Dimensi

**Openness (O) — Keterbukaan:**
1. Saya senang mencoba cara baru dalam menjalankan ibadah harian
2. Saya tertarik mendiskusikan ide-ide baru tentang cara mendidik anak
3. Ketika ada masalah keluarga, saya suka mencari perspektif baru
4. Saya nyaman jika rutinitas harian saya berubah
5. Saya suka mempelajari hal baru tentang agama dan kehidupan
6. Saya terbuka terhadap pendapat yang berbeda dari keluarga

**Conscientiousness (C) — Ketelitian:**
1. Saya merencanakan keuangan keluarga dengan teliti sebelum membelanjakan
2. Saya biasanya menyelesaikan tugas sebelum bersantai
3. Saya menjaga janji dan komitmen dengan konsisten
4. Rumah saya selalu dalam keadaan teratur
5. Saya mempersiapkan diri jauh-jauh hari sebelum acara penting
6. Saya memiliki jadwal harian yang cukup terstruktur

**Extraversion (E) — Ekstroversi:**
1. Setelah seharian bekerja, saya lebih suka berkumpul bersama keluarga besar
2. Saya merasa berenergi setelah bertemu banyak orang
3. Saya aktif memulai percakapan di acara keluarga
4. Saya lebih suka gathering keluarga daripada malam tenang di rumah
5. Saya mudah berkenalan dengan orang baru
6. Saya sering menjadi pusat percakapan dalam acara bersama

**Agreeableness (A) — Keramahan:**
1. Saya memprioritaskan keharmonisan keluarga di atas pendapat saya sendiri
2. Saya mudah memaafkan anggota keluarga yang bersalah
3. Saya senang membantu orang lain meski tidak diminta
4. Saya jarang berkonflik dengan orang-orang di sekitar saya
5. Saya lebih suka berkompromi daripada mempertahankan pendapat
6. Saya peduli dengan perasaan orang lain sebelum berbicara

**Neuroticism (N) — Stabilitas Emosi (reverse: rendah = lebih stabil):**
1. Saya sering merasa khawatir tentang masa depan keluarga
2. Saya sulit tidur ketika ada masalah yang belum terselesaikan
3. Saya mudah merasa tertekan ketika banyak tekanan dari luar
4. Emosi saya cukup stabil di berbagai situasi *(reverse scored)*
5. Saya sering memikirkan kesalahan masa lalu
6. Perubahan mendadak membuat saya merasa tidak nyaman

### 5.3 Hasil Test

Skor per dimensi: 6–30 (raw) → dinormalisasi ke 0–100.

Disimpan di `taaruf_profiles.personality_scores`:
```json
{
  "O": 72,
  "C": 85,
  "E": 38,
  "A": 91,
  "N": 25,
  "taken_at": "2026-09-01T10:00:00Z",
  "can_update_at": "2027-03-01T10:00:00Z"
}
```

---

## 6. Browsing & Limit

### 6.1 Tampilan List (Bebas, Tanpa Limit)

User bisa scroll daftar profil tanpa batas. Yang ditampilkan di list:
- Inisial nama (misal: M***)
- Usia & kota
- Pendidikan
- 3 hobi/minat teratas
- Compatibility score (%) — hanya muncul jika test sudah diisi kedua pihak
- **Tidak ada foto** di list view

### 6.2 Buka Detail Profil — Limit 5 per Hari

- Membuka halaman detail = 1 kredit
- **Limit: 5 kredit per hari**, reset jam 00:00 WIB
- Counter di UI: *"3 dari 5 profil hari ini tersisa"*
- Profil yang sudah dibuka hari yang sama → tidak mengurangi kredit jika dibuka lagi
- Yang tampil di detail: foto, biodata lengkap *(profil orang tua & kesehatan hanya setelah CV diterima)*

### 6.3 Kirim CV

- Tidak dibatasi jumlah per hari
- Dibatasi oleh **status**: hanya bisa punya **1 koneksi aktif** sekaligus
- Koneksi aktif = status `proposed` sampai `serius`
- Setelah koneksi selesai (rejected/expired) → langsung bisa kirim CV baru, **tanpa cooling period**

---

## 7. Alur Lengkap & State Machine

### 7.1 Status Profil Ta'aruf

```
incomplete
    ↓ (onboarding selesai)
active
    ↓ (kirim/terima CV & diproses)
in_process
    ↓ (kedua wali konfirmasi)         ↓ (ditolak / expired)
  serius                              active (bisa browse lagi)
    ↓ (nikah dikonfirmasi)
  married (profil ditutup permanen)
```

### 7.2 Status Koneksi (taaruf_connections)

```
proposed
  ├── wali_approved  ←─ wali wanita terima CV
  │       ↓
  │   cv_rejected   ←─ wali wanita tolak → kedua profil active
  │
  └── intro_chat_active  ←─ calon wanita + wali setuju
          ↓
    [2 minggu, extend 1x +1 minggu]
          ↓ expired tanpa keputusan
    intro_chat_expired → kedua profil active
          ↓ sepakat lanjut
    invitation_sent  ←─ wali pria APPROVE dulu sebelum terkirim
          ├── rejected  ←─ wali wanita tolak → kedua profil active
          └── invitation_accepted
                  ↓
          konfirmasi_final
          (4 pihak: kedua calon + kedua wali)
                  ↓
              serius
                  ↓ (nikah dikonfirmasi)
              married
```

### 7.3 Detail Setiap Tahap

**proposed → wali_approved / cv_rejected**
- Pria kirim CV + pesan (min 20 karakter)
- Wali PRIA: notifikasi saja (tidak perlu approve di tahap ini)
- Wali WANITA: dapat notifikasi, review profil publik pria
- Wali wanita respond dalam [batas waktu TBD]:
  - Terima → `wali_approved` → profil lengkap + orang tua + kesehatan visible ke wali & calon wanita
  - Tolak → `cv_rejected` → pria dapat notif "Belum cocok kali ini" (tanpa detail alasan)

**wali_approved → intro_chat_active**
- Calon wanita & wali berdiskusi (lihat profil lengkap)
- Calon wanita & wali sepakat → `cv_accepted` → room chat pengenalan dibuat
- Atau tolak → `cv_rejected`

**intro_chat_active**
- Room berisi: pria + wali pria + (opsional: keluarga inti pria) + wanita + wali wanita + (opsional: keluarga inti wanita)
- Pria dan wanita tidak bisa DM satu sama lain — semua pesan ke room kolektif
- Durasi: **2 minggu**
- Perpanjang 1x (+1 minggu) jika kedua pihak setuju
- Notifikasi H-2 sebelum expired

**invitation_sent**
- Pria atau walinya inisiasi "Kirim Undangan Serius"
- Wali PRIA harus **approve** dulu — sistem tahan undangan sampai ada approval
- Setelah approve → notifikasi ke wali WANITA (bukan langsung ke calon wanita)
- Wali wanita respond:
  - Accept → `invitation_accepted`
  - Decline → `rejected` → kedua profil kembali active

**konfirmasi_final**
- Summary ditampilkan ke semua 4 pihak
- Masing-masing klik "Konfirmasi Final"
- Setelah semua 4 konfirmasi → status `serius`
- Room chat pengenalan **tidak dihapus** — dikonversi jadi room keluarga gabungan permanen
- Profil kedua calon status → `serius` (tidak bisa terima/kirim CV baru)

**married**
- Salah satu pihak input konfirmasi nikah di platform
- Sistem buat `marriages`, `nuclear_family` baru, update `nodes`
- Profil ta'aruf status → `married` (ditutup permanen)

---

## 8. Chat Pengenalan Keluarga

### 8.1 Anggota Room

| Role | Siapa | Permission |
|---|---|---|
| `candidate` | Calon pria & calon wanita | Kirim pesan ke room (tidak ada DM antar calon) |
| `wali` | Wali pria & wali wanita | Kirim pesan, approve extend, inisiasi invitation |
| `family` | Keluarga inti (join opsional) | Kirim pesan, lihat profil |

### 8.2 Aturan "Tidak Berdua"

- Tidak ada fitur direct message antar calon di room ini
- Semua pesan visible ke semua anggota room
- Ini enforced di level aplikasi (tidak ada UI untuk DM)

### 8.3 Lifecycle

```
Room dibuat
    ↓
Active: 14 hari
    ↓
Hari ke-12: notifikasi "Chat akan expired dalam 2 hari"
    ↓
Salah satu pihak request extend
    → Pihak lain: Accept (24 jam untuk respond) → +7 hari
    → Decline atau tidak respond → tidak jadi extend
    ↓
Expired:
    → Soft-delete (tidak bisa diakses)
    → 7 hari kemudian: hard-delete semua pesan
    → Status koneksi → intro_chat_expired
    → Kedua profil → active
```

### 8.4 Konversi ke Room Permanen

Jika proses lanjut ke `serius`:
- Room chat pengenalan **tidak dihapus**
- Dikonversi menjadi room keluarga gabungan permanen
- Scope diubah dari `taaruf_intro` ke `general`
- Extended family group kedua keluarga di-merge

---

## 9. Invitation Serius & Konfirmasi Final

### 9.1 Kirim Invitation

1. Pria (atau wali pria) klik "Kirim Undangan Serius"
2. Sistem tampilkan form pesan undangan (min 20 karakter)
3. Submit → status sementara `pending_wali_approval`
4. Notifikasi ke WALI PRIA: "Anakmu ingin kirim undangan serius. Setujui?"
5. Wali pria Approve → undangan terkirim ke pihak wanita
6. Wali pria Decline → undangan dibatalkan, kembali ke `intro_chat_active`

### 9.2 Respond Invitation

1. Notifikasi ke WALI WANITA: "Ada undangan serius masuk"
2. Wali wanita review + diskusi dengan calon wanita
3. Wali wanita Decline → `rejected` → kedua profil active
4. Wali wanita Accept → `invitation_accepted` → menuju konfirmasi final

### 9.3 Konfirmasi Final

Tampil halaman summary ke semua 4 pihak (kedua calon + kedua wali):

> *"Dengan ini, proses ta'aruf antara [nama pria] dan [nama wanita] berlanjut ke tahap serius. Keputusan ini akan menjadi dasar proses menuju pernikahan."*

Semua 4 pihak harus klik "Konfirmasi" secara terpisah. Setelah semua confirm:
- Status koneksi → `serius`
- Room chat dikonversi ke permanen
- Kedua profil status → `serius`
- Konsultasi konselor diprioritaskan (fitur premium — pending implementasi)

---

## 10. Schema Database

### 10.1 Modifikasi `taaruf_profiles`

```sql
-- Migration 022_restructure_taaruf.sql

ALTER TABLE taaruf_profiles
  -- Status baru
  DROP COLUMN IF EXISTS status,
  ADD COLUMN status VARCHAR(20) DEFAULT 'incomplete'
    CHECK (status IN (
      'incomplete', 'onboarding', 'active',
      'in_process', 'serius', 'married'
    )),

  -- Personality test
  ADD COLUMN IF NOT EXISTS personality_scores   JSONB,
  -- {"O":72,"C":85,"E":38,"A":91,"N":25,"taken_at":"...","can_update_at":"..."}
  ADD COLUMN IF NOT EXISTS personality_taken_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS personality_can_update_at  TIMESTAMPTZ,

  -- Profil orang tua (pull otomatis + bisa override manual)
  ADD COLUMN IF NOT EXISTS parent_profile JSONB,
  -- {
  --   "father": {"name":"...","occupation":"...","city":"...","hobbies":["..."]},
  --   "mother": {"name":"...","occupation":"...","city":"...","hobbies":["..."]},
  --   "pulled_at": "2026-09-01T00:00:00Z"
  -- }

  -- Kondisi kesehatan (opsional, hanya visible setelah CV diterima)
  ADD COLUMN IF NOT EXISTS health_notes         TEXT,
  ADD COLUMN IF NOT EXISTS health_notes_enabled BOOLEAN DEFAULT false,

  -- Wali
  ADD COLUMN IF NOT EXISTS wali_user_id         INTEGER REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS wali_type            VARCHAR(20)
    CHECK (wali_type IN ('family_tree', 'platform_user', 'external')),
  ADD COLUMN IF NOT EXISTS wali_external_name    TEXT,
  ADD COLUMN IF NOT EXISTS wali_external_contact TEXT,
  ADD COLUMN IF NOT EXISTS wali_confirmed_at     TIMESTAMPTZ,

  -- Browse limit harian
  ADD COLUMN IF NOT EXISTS daily_view_count    INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS daily_view_reset_at DATE DEFAULT CURRENT_DATE,

  -- Onboarding progress tracker
  ADD COLUMN IF NOT EXISTS onboarding_step INTEGER DEFAULT 0;
  -- 0=belum, 1=penjelasan, 2=test, 3=biodata, 4=wali → bisa browse
```

### 10.2 Tabel Baru: `taaruf_connections`

Menggantikan `taaruf_applications`.

```sql
CREATE TABLE IF NOT EXISTS taaruf_connections (
  id                        SERIAL PRIMARY KEY,
  initiator_profile_id      INTEGER NOT NULL REFERENCES taaruf_profiles(id),
  recipient_profile_id      INTEGER NOT NULL REFERENCES taaruf_profiles(id),

  status VARCHAR(30) NOT NULL DEFAULT 'proposed'
    CHECK (status IN (
      'proposed',               -- CV dikirim
      'wali_approved',          -- wali wanita terima CV
      'cv_rejected',            -- wali wanita tolak CV
      'intro_chat_active',      -- room pengenalan aktif
      'intro_chat_expired',     -- expired tanpa keputusan
      'pending_wali_approval',  -- menunggu wali pria approve invitation
      'invitation_sent',        -- undangan serius terkirim
      'rejected',               -- undangan ditolak
      'invitation_accepted',    -- wali wanita terima undangan
      'konfirmasi_final',       -- menunggu 4 konfirmasi
      'serius',                 -- semua konfirmasi → lanjut nikah
      'married',                -- nikah dikonfirmasi
      'cancelled'               -- dibatalkan
    )),

  -- CV
  cv_message                TEXT,          -- pesan dari initiator, min 20 karakter
  cv_response_message       TEXT,          -- pesan dari wali wanita saat accept/reject

  -- Intro chat
  intro_chat_room_id        UUID REFERENCES chat_rooms(id),
  intro_chat_created_at     TIMESTAMPTZ,
  intro_chat_expires_at     TIMESTAMPTZ,   -- created_at + 14 hari
  intro_chat_extended       BOOLEAN DEFAULT false,
  intro_chat_extended_at    TIMESTAMPTZ,

  -- Invitation serius
  invitation_message        TEXT,
  invitation_sent_at        TIMESTAMPTZ,
  invitation_sent_by        INTEGER REFERENCES users(id),
  invitation_responded_at   TIMESTAMPTZ,
  invitation_response_msg   TEXT,

  -- Konfirmasi final (4 pihak)
  initiator_confirmed         BOOLEAN DEFAULT false,
  recipient_confirmed         BOOLEAN DEFAULT false,
  wali_initiator_confirmed    BOOLEAN DEFAULT false,
  wali_recipient_confirmed    BOOLEAN DEFAULT false,
  confirmed_at                TIMESTAMPTZ,

  -- Hasil akhir
  permanent_room_id         UUID REFERENCES chat_rooms(id),
  marriage_id               INTEGER REFERENCES marriages(id),

  created_at                TIMESTAMPTZ DEFAULT NOW(),
  updated_at                TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(initiator_profile_id, recipient_profile_id)
);

CREATE INDEX idx_tc_initiator ON taaruf_connections(initiator_profile_id);
CREATE INDEX idx_tc_recipient ON taaruf_connections(recipient_profile_id);
CREATE INDEX idx_tc_status    ON taaruf_connections(status);
CREATE INDEX idx_tc_expires   ON taaruf_connections(intro_chat_expires_at)
  WHERE status = 'intro_chat_active';
```

### 10.3 Tabel Baru: `taaruf_wali_requests`

```sql
CREATE TABLE IF NOT EXISTS taaruf_wali_requests (
  id                  SERIAL PRIMARY KEY,
  profile_id          INTEGER NOT NULL REFERENCES taaruf_profiles(id),
  requested_user_id   INTEGER NOT NULL REFERENCES users(id),
  status              VARCHAR(20) DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined')),
  message             TEXT,
  responded_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);
```

### 10.4 Tabel Baru: `taaruf_chat_extend_requests`

```sql
CREATE TABLE IF NOT EXISTS taaruf_chat_extend_requests (
  id                      SERIAL PRIMARY KEY,
  connection_id           INTEGER NOT NULL REFERENCES taaruf_connections(id),
  requested_by_user_id    INTEGER NOT NULL REFERENCES users(id),
  other_party_responded   VARCHAR(10) DEFAULT 'pending'
    CHECK (other_party_responded IN ('pending', 'accepted', 'declined')),
  responded_at            TIMESTAMPTZ,
  created_at              TIMESTAMPTZ DEFAULT NOW()
);
```

### 10.5 Tabel Baru: `taaruf_profile_views`

Tracking limit 5 view detail per hari:

```sql
CREATE TABLE IF NOT EXISTS taaruf_profile_views (
  id                  SERIAL PRIMARY KEY,
  viewer_user_id      INTEGER NOT NULL REFERENCES users(id),
  viewed_profile_id   INTEGER NOT NULL REFERENCES taaruf_profiles(id),
  viewed_date         DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(viewer_user_id, viewed_profile_id, viewed_date)
);

CREATE INDEX idx_tpv_viewer_date
  ON taaruf_profile_views(viewer_user_id, viewed_date);
```

### 10.6 Tabel yang Tetap Ada Tanpa Perubahan

- `taaruf_criteria` — tetap, tidak berubah
- `room_memberships` — tetap, dipakai untuk room taaruf

### 10.7 Tabel yang Digantikan

- `taaruf_applications` → digantikan `taaruf_connections`  
  (data lama perlu di-migrate atau diarsipkan)

---

## 11. API Endpoints

### Onboarding & Profil

| Method | Endpoint | Fungsi |
|---|---|---|
| `GET` | `/api/taaruf` | Status lengkap + onboarding progress |
| `PATCH` | `/api/taaruf/onboarding/step` | Update step onboarding |
| `POST` | `/api/taaruf/personality-test` | Submit hasil test |
| `GET` | `/api/taaruf/personality-test` | Ambil hasil + kapan bisa update |
| `POST` | `/api/taaruf/profile` | Simpan/update biodata |
| `GET` | `/api/taaruf/profile/parents` | Pull profil orang tua dari pohon |
| `PATCH` | `/api/taaruf/profile/health` | Update kondisi kesehatan |

### Wali

| Method | Endpoint | Fungsi |
|---|---|---|
| `GET` | `/api/taaruf/wali/resolve` | Cari wali otomatis dari pohon keluarga |
| `POST` | `/api/taaruf/wali/request` | Request user platform jadi wali |
| `PUT` | `/api/taaruf/wali/request/:id` | Accept / decline wali request |
| `POST` | `/api/taaruf/wali/external` | Tambah wali administrasi eksternal |
| `POST` | `/api/taaruf/wali/confirm-external` | Konfirmasi wali eksternal sudah setuju |
| `PUT` | `/api/taaruf/wali/replace` | Ganti wali (jika meninggal/tidak aktif) |

### Browse

| Method | Endpoint | Fungsi |
|---|---|---|
| `GET` | `/api/taaruf/browse` | List profil thumbnail (tanpa foto, tanpa limit) |
| `GET` | `/api/taaruf/browse/:profileId` | Buka detail profil (konsumsi 1 kredit) |
| `GET` | `/api/taaruf/browse/credits` | Sisa kredit hari ini |

### Connections

| Method | Endpoint | Fungsi |
|---|---|---|
| `POST` | `/api/taaruf/connections` | Kirim CV |
| `GET` | `/api/taaruf/connections` | List koneksi user |
| `GET` | `/api/taaruf/connections/:id` | Detail koneksi |
| `PUT` | `/api/taaruf/connections/:id/wali-respond` | Wali wanita respond CV |
| `POST` | `/api/taaruf/connections/:id/extend` | Request perpanjang chat |
| `PUT` | `/api/taaruf/connections/:id/extend-respond` | Pihak lain respond extend |
| `POST` | `/api/taaruf/connections/:id/invite` | Inisiasi invitation serius |
| `PUT` | `/api/taaruf/connections/:id/wali-approve-invite` | Wali pria approve invitation |
| `PUT` | `/api/taaruf/connections/:id/invite-respond` | Wali wanita respond invitation |
| `PUT` | `/api/taaruf/connections/:id/confirm` | Salah satu dari 4 pihak konfirmasi final |
| `POST` | `/api/taaruf/connections/:id/married` | Konfirmasi nikah → update pohon keluarga |

---

## 12. Algoritma Resolve Wali

Query traversal pohon keluarga untuk mencari wali sesuai urutan fiqih:

```sql
WITH RECURSIVE wali_search AS (

  -- Step 1: Ayah kandung
  SELECT
    n_parent.id           AS wali_node_id,
    n_parent.user_id      AS wali_user_id,
    u.full_name,
    1                     AS priority,
    'Ayah'                AS relasi
  FROM nodes n_user
  JOIN parent_child_relations pcr
    ON pcr.child_node_id = n_user.id AND pcr.parent_type = 'father'
  JOIN nodes n_parent ON n_parent.id = pcr.parent_node_id
  JOIN users u ON u.id = n_parent.user_id
  WHERE n_user.user_id = $userId
    AND n_parent.gender = 'male'
    AND n_parent.user_id IS NOT NULL

  UNION ALL

  -- Step 2: Kakek (ayah dari ayah)
  SELECT
    n_grand.id, n_grand.user_id, u.full_name, 2, 'Kakek'
  FROM nodes n_user
  JOIN parent_child_relations pcr1
    ON pcr1.child_node_id = n_user.id AND pcr1.parent_type = 'father'
  JOIN parent_child_relations pcr2
    ON pcr2.child_node_id = pcr1.parent_node_id AND pcr2.parent_type = 'father'
  JOIN nodes n_grand ON n_grand.id = pcr2.parent_node_id
  JOIN users u ON u.id = n_grand.user_id
  WHERE n_user.user_id = $userId
    AND n_grand.gender = 'male'
    AND n_grand.user_id IS NOT NULL

  -- ... dst untuk saudara kandung, keponakan, paman
)
SELECT * FROM wali_search
ORDER BY priority ASC
LIMIT 1;
```

Jika hasil kosong → tampil UI request wali platform atau tambah wali eksternal.

---

## 13. Algoritma Compatibility Score

### 13.1 Pola Matching per Dimensi

| Dimensi | Pola | Alasan |
|---|---|---|
| Extraversion (E) | Complementary | E tinggi + E rendah lebih stabil jangka panjang |
| Agreeableness (A) | Similarity | Keduanya tinggi = lebih harmonis |
| Conscientiousness (C) | Similarity | Keduanya teratur atau keduanya santai |
| Openness (O) | Complementary | Saling melengkapi dalam cara pandang |
| Neuroticism (N) | Similarity (rendah-rendah ideal) | N tinggi-tinggi = paling berisiko konflik |

### 13.2 Formula

```
// Complementary match: semakin beda → semakin tinggi
complementary(a, b) = 100 - |a - b| / max_diff × 100
// Di sini justru dibalik: semakin beda → lebih cocok
// Gunakan: |a - b| / max_diff × 100 (semakin beda = semakin tinggi)
complementary(a, b) = |a - b| / 100 × 100

// Similarity match: semakin mirip → semakin tinggi
similarity(a, b) = 100 - |a - b| / 100 × 100

// Neuroticism: keduanya rendah = ideal
// Hukum: jika N_A + N_B < threshold (misal 80) → bonus score
neuroticism_score = 100 - (N_A + N_B) / 2

// Final weighted score
score = (
  complementary(E_A, E_B) × 0.25 +
  similarity(A_A, A_B)     × 0.25 +
  similarity(C_A, C_B)     × 0.20 +
  complementary(O_A, O_B)  × 0.15 +
  neuroticism_score         × 0.15
)
```

Score 0–100 ditampilkan sebagai persentase di profil list.

---

## 14. Cron Jobs

| Job | Jadwal | Fungsi |
|---|---|---|
| `expire-taaruf-chats` | Setiap jam | Cek `intro_chat_expires_at < NOW()`, update status → `intro_chat_expired`, soft-delete room |
| `cleanup-taaruf-rooms` | Harian 03:00 UTC | Hard-delete pesan dari room yang expired > 7 hari |
| `notify-chat-expiring` | Harian 09:00 UTC | Notifikasi ke user yang chat-nya expired dalam 2 hari |
| `reset-view-credits` | Harian 00:00 WIB | Reset `daily_view_count = 0` untuk semua profil |
| `expire-wali-requests` | Harian | Reminder ke wali yang belum respond dalam 3 hari |

---

## 15. UI Screens

| Screen | Komponen | Sprint |
|---|---|---|
| Layar penjelasan fitur | `TaarufExplainer.tsx` | 1 |
| Personality test | `PersonalityTest.tsx` | 1 |
| Form biodata 4 tab | `TaarufProfileForm.tsx` (update) | 1 |
| Setup wali | `WaliSetupScreen.tsx` | 1 |
| Browse list | `TaarufBrowse.tsx` | 2 |
| Detail profil calon | `TaarufProfileDetail.tsx` | 2 |
| Counter kredit harian | bagian dari Browse | 2 |
| Kirim CV sheet | `SendCVSheet.tsx` | 2 |
| Status koneksi aktif | `ActiveConnectionCard.tsx` | 2 |
| Notifikasi wali (CV masuk) | `WaliInboxScreen.tsx` | 2 |
| Room chat pengenalan | `IntroChatRoom.tsx` | 3 |
| Request perpanjang | `ExtendChatSheet.tsx` | 3 |
| Kirim invitation serius | `InvitationScreen.tsx` | 4 |
| Wali pria approve invitation | `WaliApproveInvite.tsx` | 4 |
| Konfirmasi final | `FinalConfirmScreen.tsx` | 4 |
| Konfirmasi nikah | `MarriageConfirmScreen.tsx` | 4 |

---

## 16. Sprint Plan

### Sprint 1 — Pondasi: DB + Wali + Onboarding

- [ ] Migration `022_restructure_taaruf.sql`
- [ ] Drop/archive `taaruf_applications`, buat `taaruf_connections`
- [ ] Buat `taaruf_wali_requests`, `taaruf_chat_extend_requests`, `taaruf_profile_views`
- [ ] `GET /api/taaruf/wali/resolve` — traversal pohon
- [ ] `POST /api/taaruf/wali/request` + `PUT .../request/:id`
- [ ] `POST /api/taaruf/wali/external` + confirm
- [ ] `PUT /api/taaruf/wali/replace`
- [ ] `POST /api/taaruf/personality-test` + scoring
- [ ] Update `POST /api/taaruf/profile` — tambah parent pull + health
- [ ] UI: `TaarufExplainer`, `PersonalityTest`, update `TaarufProfileForm`, `WaliSetupScreen`
- [ ] Update `page.tsx` state machine (tambah onboarding flow)

### Sprint 2 — Browse & Kirim CV

- [ ] `GET /api/taaruf/browse` — list dengan compatibility score
- [ ] `GET /api/taaruf/browse/:id` — detail + view credit tracking
- [ ] `GET /api/taaruf/browse/credits`
- [ ] `POST /api/taaruf/connections` — kirim CV
- [ ] `PUT /api/taaruf/connections/:id/wali-respond` — wali wanita respond
- [ ] UI: `TaarufBrowse`, `TaarufProfileDetail`, `SendCVSheet`, `ActiveConnectionCard`, `WaliInboxScreen`

### Sprint 3 — Chat Pengenalan

- [ ] Buat room taaruf_intro dengan role enforcement
- [ ] UI: `IntroChatRoom.tsx` (no DM antar calon)
- [ ] `POST /api/taaruf/connections/:id/extend`
- [ ] `PUT /api/taaruf/connections/:id/extend-respond`
- [ ] UI: `ExtendChatSheet.tsx`
- [ ] Cron: `expire-taaruf-chats`, `notify-chat-expiring`, `cleanup-taaruf-rooms`

### Sprint 4 — Invitation, Konfirmasi, Nikah

- [ ] `POST /api/taaruf/connections/:id/invite`
- [ ] `PUT /api/taaruf/connections/:id/wali-approve-invite`
- [ ] `PUT /api/taaruf/connections/:id/invite-respond`
- [ ] `PUT /api/taaruf/connections/:id/confirm` (4 pihak)
- [ ] `POST /api/taaruf/connections/:id/married`
- [ ] Konversi room intro → room permanen
- [ ] Update pohon keluarga (marriages, nuclear_family)
- [ ] UI: `InvitationScreen`, `WaliApproveInvite`, `FinalConfirmScreen`, `MarriageConfirmScreen`

### Sprint 5 — Polish & Notifikasi

- [ ] Sistem notifikasi per stage (wali, CV diterima, invitation, dll)
- [ ] Cron: `reset-view-credits`, `expire-wali-requests`
- [ ] Update compatibility score saat test di-update
- [ ] Integrasi konsultasi konselor (pending — lihat bagian 19)

---

## 17. Yang Sudah Diimplementasi (Legacy)

Dari implementasi sebelumnya yang perlu di-preserve atau di-migrate:

| Yang ada | Nasib |
|---|---|
| `taaruf_profiles` (basic) | Dipertahankan + ALTER untuk kolom baru |
| `taaruf_criteria` | Dipertahankan tanpa perubahan |
| `taaruf_applications` | Di-archive, digantikan `taaruf_connections` |
| `room_memberships` | Dipertahankan |
| `GET /api/taaruf` | Di-update response shape |
| `POST /api/taaruf` | Di-update tambah parent + health |
| `POST /api/taaruf/applications` | Dihapus, digantikan `/connections` |
| `PUT /api/taaruf/applications/:id` | Dihapus, digantikan `/connections/:id/invite-respond` |
| `TaarufProfileForm.tsx` | Di-update tambah 4 tab baru |
| `SwipeDeck.tsx`, `SwipeCard.tsx` | Di-update untuk flow browse baru |
| `ConfirmSheet.tsx` | Di-update untuk `SendCVSheet` |
| `WaitingScreen.tsx` | Di-update untuk status baru |
| `MatchedChatRoom.tsx` | Di-update jadi `IntroChatRoom` |
| `EmptyInbox.tsx` | Dipertahankan |
| `useTaaruf.ts` | Di-update seluruhnya untuk state machine baru |

---

## 18. Perubahan dari Implementasi Lama

| Aspek | Lama | Baru |
|---|---|---|
| Alur | Pria swipe → langsung apply | Onboarding wajib → browse → wali approve CV |
| Keluarga | Baru dilibatkan saat accepted | Dilibatkan dari awal (wali approve CV) |
| Chat | Langsung dibuat saat accepted | Dibuat setelah CV diterima wali, sementara |
| Status relasi | `pending/accepted/rejected` | 14 status, mencerminkan setiap tahap |
| Wali | Tidak ada | Sistem wali berbasis pohon keluarga fiqih |
| Personality | Tidak ada | Hybrid Big Five + konteks Islam |
| Browse limit | Tidak ada | 5 detail profil per hari |
| Pernikahan | Otomatis saat accepted | Perlu konfirmasi 4 pihak dulu |
| Chat lifecycle | Permanen | Expired 2 minggu (+1x extend), konversi jika lanjut |

---

## 19. Pending

| # | Item | Keterangan |
|---|---|---|
| 1 | **Konsultasi konselor premium** | Terintegrasi di dalam ta'aruf atau menu terpisah — belum diputuskan |
| 2 | **Batas waktu wali respond CV** | Berapa hari wali punya waktu untuk respond sebelum CV dianggap expired? |
| 3 | **Notifikasi channel** | Push notification (browser), in-app, atau email? |
| 4 | **Profil calon yang belum isi test** | Apakah tetap muncul di browse atau disembunyikan? |
