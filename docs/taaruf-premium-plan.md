# Planning: Ta'aruf Premium — CeritaKeluarga
**Status:** Draft final — siap review sebelum implementasi  
**Tanggal:** September 2026  
**Dokumen terkait:** `taaruf-restructure-plan.md`, `taaruf-implementation-summary.md`

---

## 1. Visi

Ta'aruf di CeritaKeluarga bukan dating app. Ini adalah proses pengenalan yang:

- Melibatkan keluarga inti dari kedua pihak sejak awal
- Memiliki sistem wali berbasis pohon silsilah keluarga
- Menjaga adab — kedua calon tidak pernah berdua tanpa keluarga
- Berbasis kompatibilitas kepribadian, bukan hanya penampilan
- Transparan — profil orang tua, hobi, bahkan kondisi kesehatan (opsional)
- Bersifat sementara sampai ada keputusan — tidak menggantung

---

## 2. Syarat Akses

- Usia minimal **18 tahun** (berdasarkan tanggal lahir di `nodes.birth_date`)
- Belum memiliki spouse aktif (`marriages.status = 'married'`)
- Profil ta'aruf **lengkap** (biodata + test personality selesai)
- Wali sudah **dikonfirmasi** (dari pohon keluarga, platform user, atau eksternal)
- Belum sedang `in_process` dengan orang lain

---

## 3. Onboarding — Wajib Sebelum Bisa Browse

User tidak bisa langsung browse. Harus melewati 4 tahap berurutan:

```
Layar Penjelasan Fitur
        ↓
Screening Personality Test
        ↓
Isi Biodata Lengkap
        ↓
Setup Wali
        ↓
[BISA BROWSE]
```

### 3.1 Layar Penjelasan Fitur

Sebelum apapun, user membaca penjelasan:
- Apa itu ta'aruf dan bedanya dengan dating app
- Bagaimana keluarga dilibatkan
- Prinsip "tidak berdua" di chat
- Chat pengenalan bersifat sementara (2 minggu)
- Komitmen yang diharapkan — ini bukan untuk iseng

Tombol "Saya Mengerti & Siap Memulai" baru muncul setelah scroll sampai bawah.

### 3.2 Screening Personality Test

**Pendekatan: Hybrid Big Five + Konteks Islam**

Big Five (OCEAN) sebagai backbone ilmiah, pertanyaannya dikemas dengan konteks kehidupan sehari-hari Muslim:

| Dimensi | Contoh pertanyaan kontekstual |
|---|---|
| **Openness** | "Ketika ada perbedaan pendapat di keluarga, saya lebih suka..." |
| **Conscientiousness** | "Dalam mengelola keuangan rumah tangga, saya cenderung..." |
| **Extraversion** | "Setelah seharian bekerja, cara saya recharge adalah..." |
| **Agreeableness** | "Ketika pasangan punya pendapat berbeda soal pola asuh anak..." |
| **Neuroticism** | "Saat ada masalah besar yang belum terselesaikan, saya biasanya..." |

Total pertanyaan: **30 pertanyaan** (6 per dimensi), estimasi waktu 10–15 menit.

**Algoritma Compatibility (Complementary Matching):**

Tidak semua dimensi butuh pasangan yang berbeda. Riset menunjukkan:

| Dimensi | Pola ideal |
|---|---|
| Extraversion | Complementary — E tinggi + E rendah lebih stabil |
| Agreeableness | Similarity — keduanya tinggi lebih harmonis |
| Conscientiousness | Similarity — keduanya tinggi (atau sama-sama rendah) |
| Openness | Complementary atau similarity tergantung konteks |
| Neuroticism | Similarity (rendah-rendah) paling ideal, high-high paling berisiko |

Formula compatibility score (0–100):
```
score = Σ(weight[i] × match_value[i]) / Σ(weight[i])

match_value per dimensi:
  - Complementary: 100 - |skor_A - skor_B| / max_diff × 100
    (semakin beda → semakin tinggi)
  - Similarity: 100 - |skor_A - skor_B| / max_diff × 100
    (semakin mirip → semakin tinggi)
```

**Update test:** Bisa diulang setelah **6 bulan** dari test terakhir. Jika diupdate, compatibility score dengan koneksi aktif di-recalculate.

### 3.3 Biodata Lengkap

**Tab 1 — Profil Pribadi:**
- Nama (auto-fill dari `nodes.full_name`, readonly)
- Usia (auto dari `nodes.birth_date`, readonly)
- Foto profil (upload)
- Kota domisili
- Pendidikan terakhir
- Pekerjaan
- Tentang diri (min 100 karakter)
- Hobi & minat (multi-select chips, min 3)

**Tab 2 — Profil Orang Tua (Pull Otomatis dari Pohon Keluarga):**

Data di-pull otomatis dari `parent_child_relations` → `nodes` → `users`.

Ditampilkan:
- Nama ayah & ibu (dari pohon keluarga)
- Pekerjaan ayah & ibu (dari `nodes.occupation` jika ada)
- Kota domisili keluarga
- Hobi/minat ayah & ibu (dari `nodes` jika ada)

User bisa tambahkan secara manual jika orang tua tidak ada di pohon atau ingin menambahkan info.

Catatan di UI: *"Info ini hanya ditampilkan ke calon setelah CV kamu diterima."*

**Tab 3 — Kondisi Kesehatan (Opsional, 100% Sukarela):**
- Toggle "Saya ingin mencantumkan informasi kesehatan"
- Jika ya: textarea bebas (user ceritakan sendiri dengan bahasa mereka)
- Contoh prompt: *"Misalnya: kondisi genetik, alergi, kondisi kronis. Hanya untuk transparansi, bukan syarat."*
- Watermark di UI: *"Informasi ini hanya dilihat oleh calon setelah CV diterima, tidak tampil di profil publik."*

**Tab 4 — Kriteria Pasangan:**
- Rentang usia (range slider)
- Kota/wilayah yang diinginkan
- Pendidikan minimum (pilihan)
- Status pernikahan calon (belum menikah / janda/duda)
- Catatan tambahan (opsional)

### 3.4 Setup Wali

Lihat detail di **Bagian 4**.

---

## 4. Sistem Wali

### Hierarki Pencarian Otomatis (Urutan Fiqih Standar)

Sistem traverse pohon keluarga secara otomatis:

```
1. Ayah kandung
2. Kakek dari jalur ayah (ayah dari ayah)
3. Saudara laki-laki kandung (seayah seibu)
4. Saudara laki-laki seayah (beda ibu)
5. Anak laki-laki dari saudara kandung (keponakan laki-laki)
6. Paman dari jalur ayah (saudara laki-laki ayah)
```

Semua dari pohon keluarga → sudah pasti punya akun.

### Jika Tidak Ditemukan di Pohon

**Langkah 1 — Request ke User Platform:**
- User pilih dari daftar kontak/kenalan yang terdaftar di platform
- Sistem kirim notifikasi ke orang tersebut
- Orang itu bisa Accept / Decline
- Bisa mencantumkan pesan penjelasan saat request

**Langkah 2 — Wali Administrasi Eksternal:**
- Jika tidak ada satupun di platform
- User input: nama + nomor HP/email
- Tidak punya akun, tidak ada akses sistem
- Approval dilakukan di luar platform (tatap muka/telepon)
- User klik "Konfirmasi Wali Sudah Setuju" → platform catat dengan flag `wali_type = 'external'`
- Proses ta'aruf tetap berjalan dengan catatan ini

### Wali untuk Pria (Opsi B)

Wali pria **hanya terlibat di satu momen kritis**: saat pria mengirim **Invitation Serius** (bukan saat kirim CV). Wali pria:
- Menerima notifikasi saat anak kirim CV (informasi saja, tidak perlu approve)
- **Harus approve** saat anak ingin kirim Invitation Serius
- Hadir sebagai anggota room chat pengenalan

### Wali untuk Wanita

Wali wanita lebih aktif:
- Approve/decline CV yang masuk
- Hadir di room chat pengenalan
- Approve/decline Invitation Serius
- Konfirmasi final sebelum status berubah ke `serius`

---

## 5. Browsing & Limit

### Tampilan List (Bebas)
User bisa scroll daftar profil tanpa batas. Yang ditampilkan di list:
- Inisial nama (misal: M***)
- Usia
- Kota
- Pendidikan
- 3 hobi/minat
- Compatibility score (%) — hanya muncul jika test sudah diisi kedua pihak
- Tidak ada foto di list view (foto baru muncul saat detail dibuka)

### Buka Detail Profil — Limit 5 per Hari
- Membuka halaman detail profil seseorang = 1 kredit
- Limit: **5 kredit per hari**, reset jam 00:00 WIB
- Counter ditampilkan di UI: "3 dari 5 profil hari ini"
- Profil yang sudah pernah dibuka hari ini tidak mengurangi kredit jika dibuka lagi

### Kirim CV
- Tidak dibatasi jumlah per hari
- Tapi dibatasi oleh **status**: user hanya bisa punya **1 koneksi aktif** sekaligus
- Koneksi aktif = status `proposed` sampai `serius`
- Jika koneksi selesai (rejected/expired) → langsung bisa kirim CV baru tanpa cooling period

---

## 6. Alur Lengkap dengan State Machine

### Status Profil Ta'aruf

```
incomplete → onboarding → active → in_process → serius → married
                                        ↓
                                    active (jika ditolak/expired)
```

### Status Koneksi (taaruf_connections)

```
proposed
    ↓ (wali initiator approve — untuk WANITA: wali calon approve/reject)
wali_approved
    ↓
cv_reviewed  ←── wali calon & calon review
    ↓ accept               ↓ reject
intro_chat_active      cv_rejected → initiator kembali active
    ↓
  [2 minggu]
    ↓ expired tanpa keputusan     ↓ kedua pihak sepakat
intro_chat_expired             invitation_sent
kedua profil → active               ↓ (wali wanita respond)
                           ↓ accept          ↓ decline
                    invitation_accepted    rejected
                    wali PRIA approve?  kedua profil → active
                           ↓ approve
                    konfirmasi_final
                    (kedua calon + wali konfirmasi)
                           ↓
                         serius
                           ↓ (nikah dikonfirmasi)
                         married
```

### Detail setiap tahap

**proposed → wali_approved:**
- Pria kirim CV + pesan (min 20 karakter)
- Wali PRIA: hanya dapat notifikasi (tidak perlu approve di tahap ini)
- Wali WANITA: dapat notifikasi, review profil pria (termasuk biodata + profil orang tua)
- Wali wanita: Terima → `wali_approved` / Tolak → `cv_rejected`

**wali_approved → intro_chat_active:**
- Profil lengkap pria (termasuk kesehatan jika ada) visible ke calon wanita + walinya
- Calon wanita dan walinya berdiskusi
- Jika setuju: `cv_accepted` → room chat pengenalan dibuat

**intro_chat_active:**
- Room berisi: pria + wali pria + (opsional keluarga inti pria) + wanita + wali wanita + (opsional keluarga inti wanita)
- Pria dan wanita tidak bisa DM satu sama lain (semua pesan ke room kolektif)
- Durasi: **2 minggu**
- Bisa diperpanjang **1x** (1 minggu tambahan) jika **kedua pihak** request

**invitation_sent:**
- Pria atau walinya kirim undangan serius
- Wali PRIA harus **approve** dulu sebelum undangan terkirim (Opsi B)
- Notifikasi ke wali wanita (bukan langsung ke wanita)
- Wali wanita respond: Accept / Decline

**konfirmasi_final:**
- Setelah wali wanita accept
- Tampil summary ke semua pihak (kedua calon + kedua wali)
- Semua klik "Konfirmasi Final"
- Status berubah → `serius`
- Room chat pengenalan **tidak dihapus**, dikonversi jadi room keluarga gabungan permanen
- Profile kedua calon status → `serius` (tidak bisa terima/kirim CV baru)

**married:**
- Salah satu pihak input konfirmasi nikah
- Sistem buat `marriages`, `nuclear_family` baru, update `nodes`
- Profil ta'aruf ditutup permanen

---

## 7. Chat Pengenalan — Aturan & Lifecycle

### Anggota Room

| Role | Siapa | Permission |
|---|---|---|
| `candidate` | Calon pria & wanita | Kirim pesan ke room (tidak bisa DM) |
| `wali` | Wali pria & wali wanita | Kirim pesan, approve extend, kirim invitation |
| `family` | Keluarga inti (opsional, join sendiri) | Kirim pesan |

### Aturan "Tidak Berdua"
- Tidak ada fitur direct message antar calon di dalam room ini
- Semua pesan visible ke semua anggota room
- Jika hanya pria dan wanita yang aktif (wali dan keluarga tidak buka chat), tidak ada tindakan teknis — ini diserahkan ke adab pengguna. Platform tidak bisa enforce kehadiran fisik wali.

### Lifecycle Chat

```
Created → Active (2 minggu)
    ↓
Hari ke-12: Notifikasi "Chat akan expired dalam 2 hari"
    ↓
Salah satu pihak request extend → pihak lain dapat notifikasi
    → Accept: +1 minggu
    → Decline / tidak respond 24 jam: tidak jadi extend
    ↓
Expired:
    → Chat soft-deleted (tidak bisa diakses, data disimpan 7 hari)
    → Setelah 7 hari: hard delete pesan
    → Status koneksi → intro_chat_expired
    → Kedua profil → active (bisa browse lagi)
```

---

## 8. Schema Database

### Perubahan pada `taaruf_profiles`

```sql
-- Migration 022
ALTER TABLE taaruf_profiles
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'incomplete'
    CHECK (status IN ('incomplete', 'onboarding', 'active', 'in_process', 'serius', 'married')),

  -- Personality test
  ADD COLUMN IF NOT EXISTS personality_scores JSONB,
  -- Format: {"O": 72, "C": 68, "E": 45, "A": 81, "N": 30}
  ADD COLUMN IF NOT EXISTS personality_test_taken_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS personality_test_can_update_at TIMESTAMPTZ,
  -- = personality_test_taken_at + 6 bulan

  -- Profil orang tua (pull otomatis + manual override)
  ADD COLUMN IF NOT EXISTS parent_profile JSONB,
  -- Format: {
  --   "father": {"name": "...", "occupation": "...", "city": "...", "hobbies": [...]},
  --   "mother": {"name": "...", "occupation": "...", "city": "...", "hobbies": [...]},
  --   "pulled_at": "2026-09-01T00:00:00Z"
  -- }

  -- Kondisi kesehatan (opsional, hanya visible setelah CV diterima)
  ADD COLUMN IF NOT EXISTS health_notes TEXT,
  ADD COLUMN IF NOT EXISTS health_notes_visible BOOLEAN DEFAULT false,

  -- Wali
  ADD COLUMN IF NOT EXISTS wali_user_id INTEGER REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS wali_type VARCHAR(20)
    CHECK (wali_type IN ('family_tree', 'platform_user', 'external')),
  ADD COLUMN IF NOT EXISTS wali_external_name TEXT,
  ADD COLUMN IF NOT EXISTS wali_external_contact TEXT,
  ADD COLUMN IF NOT EXISTS wali_confirmed_at TIMESTAMPTZ,

  -- Browse limit
  ADD COLUMN IF NOT EXISTS daily_view_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS daily_view_reset_at DATE DEFAULT CURRENT_DATE,

  -- Onboarding progress
  ADD COLUMN IF NOT EXISTS onboarding_step INTEGER DEFAULT 0;
  -- 0=belum, 1=explained, 2=test done, 3=biodata done, 4=wali done
```

### Tabel Baru: `taaruf_connections`

```sql
CREATE TABLE IF NOT EXISTS taaruf_connections (
  id                      SERIAL PRIMARY KEY,
  initiator_profile_id    INTEGER NOT NULL REFERENCES taaruf_profiles(id),
  recipient_profile_id    INTEGER NOT NULL REFERENCES taaruf_profiles(id),

  status VARCHAR(30) NOT NULL DEFAULT 'proposed'
    CHECK (status IN (
      'proposed',
      'wali_approved',
      'cv_reviewed',
      'cv_accepted',
      'cv_rejected',
      'intro_chat_active',
      'intro_chat_expired',
      'invitation_sent',
      'invitation_accepted',
      'konfirmasi_final',
      'serius',
      'rejected',
      'married',
      'cancelled'
    )),

  -- CV & pesan awal
  cv_message              TEXT,             -- min 20 karakter, dari initiator ke wali calon
  cv_response_message     TEXT,             -- dari wali calon saat accept/reject

  -- Chat pengenalan
  intro_chat_room_id      UUID REFERENCES chat_rooms(id),
  intro_chat_created_at   TIMESTAMPTZ,
  intro_chat_expires_at   TIMESTAMPTZ,      -- created_at + 14 hari
  intro_chat_extended     BOOLEAN DEFAULT false,
  intro_chat_extended_at  TIMESTAMPTZ,

  -- Invitation serius
  invitation_message      TEXT,
  invitation_sent_at      TIMESTAMPTZ,
  invitation_sent_by      INTEGER REFERENCES users(id),  -- pria atau walinya
  invitation_responded_at TIMESTAMPTZ,
  invitation_response_msg TEXT,

  -- Konfirmasi final
  initiator_confirmed     BOOLEAN DEFAULT false,
  recipient_confirmed     BOOLEAN DEFAULT false,
  wali_initiator_confirmed BOOLEAN DEFAULT false,
  wali_recipient_confirmed BOOLEAN DEFAULT false,
  confirmed_at            TIMESTAMPTZ,

  -- Hasil
  marriage_id             INTEGER REFERENCES marriages(id),

  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(initiator_profile_id, recipient_profile_id)
);

CREATE INDEX idx_tc_initiator ON taaruf_connections(initiator_profile_id);
CREATE INDEX idx_tc_recipient ON taaruf_connections(recipient_profile_id);
CREATE INDEX idx_tc_status    ON taaruf_connections(status);
CREATE INDEX idx_tc_expires   ON taaruf_connections(intro_chat_expires_at)
  WHERE status = 'intro_chat_active';
```

### Tabel Baru: `taaruf_wali_requests`

```sql
CREATE TABLE IF NOT EXISTS taaruf_wali_requests (
  id                SERIAL PRIMARY KEY,
  profile_id        INTEGER NOT NULL REFERENCES taaruf_profiles(id),
  requested_user_id INTEGER NOT NULL REFERENCES users(id),
  status            VARCHAR(20) DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined')),
  message           TEXT,
  responded_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);
```

### Tabel Baru: `taaruf_chat_extend_requests`

```sql
CREATE TABLE IF NOT EXISTS taaruf_chat_extend_requests (
  id                     SERIAL PRIMARY KEY,
  connection_id          INTEGER NOT NULL REFERENCES taaruf_connections(id),
  requested_by_user_id   INTEGER NOT NULL REFERENCES users(id),
  other_party_responded  VARCHAR(10) DEFAULT 'pending'
    CHECK (other_party_responded IN ('pending', 'accepted', 'declined')),
  responded_at           TIMESTAMPTZ,
  created_at             TIMESTAMPTZ DEFAULT NOW()
);
```

### Tabel Baru: `taaruf_profile_views`

Untuk tracking limit 5 view per hari:

```sql
CREATE TABLE IF NOT EXISTS taaruf_profile_views (
  id              SERIAL PRIMARY KEY,
  viewer_user_id  INTEGER NOT NULL REFERENCES users(id),
  viewed_profile_id INTEGER NOT NULL REFERENCES taaruf_profiles(id),
  viewed_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(viewer_user_id, viewed_profile_id, viewed_date)
);

CREATE INDEX idx_tpv_viewer_date ON taaruf_profile_views(viewer_user_id, viewed_date);
```

---

## 9. API Endpoints

### Onboarding & Profil

| Method | Endpoint | Fungsi |
|---|---|---|
| `GET` | `/api/taaruf` | Status lengkap + onboarding progress |
| `POST` | `/api/taaruf/personality-test` | Submit hasil test |
| `GET` | `/api/taaruf/personality-test` | Ambil hasil + kapan bisa update |
| `POST` | `/api/taaruf/profile` | Simpan biodata + parent profile |
| `PATCH` | `/api/taaruf/profile/health` | Update kondisi kesehatan |

### Wali

| Method | Endpoint | Fungsi |
|---|---|---|
| `GET` | `/api/taaruf/wali/resolve` | Cari wali otomatis dari pohon |
| `POST` | `/api/taaruf/wali/request` | Request user lain jadi wali |
| `PUT` | `/api/taaruf/wali/request/:id` | Accept/decline wali request |
| `POST` | `/api/taaruf/wali/external` | Tambah wali administrasi eksternal |
| `POST` | `/api/taaruf/wali/confirm-external` | Konfirmasi wali eksternal sudah setuju |

### Browse

| Method | Endpoint | Fungsi |
|---|---|---|
| `GET` | `/api/taaruf/browse` | List profil (thumbnail, tanpa foto, tanpa limit) |
| `GET` | `/api/taaruf/browse/:profileId` | Buka detail profil (konsumsi 1 kredit) |
| `GET` | `/api/taaruf/browse/credits` | Sisa kredit hari ini |

### Connections

| Method | Endpoint | Fungsi |
|---|---|---|
| `POST` | `/api/taaruf/connections` | Kirim CV |
| `GET` | `/api/taaruf/connections` | List koneksi aktif |
| `GET` | `/api/taaruf/connections/:id` | Detail koneksi |
| `PUT` | `/api/taaruf/connections/:id/wali-respond` | Wali wanita respond CV |
| `PUT` | `/api/taaruf/connections/:id/candidate-respond` | Calon wanita respond (opsional, bisa skip) |
| `POST` | `/api/taaruf/connections/:id/extend` | Request perpanjang chat |
| `PUT` | `/api/taaruf/connections/:id/extend-respond` | Pihak lain respond extend |
| `POST` | `/api/taaruf/connections/:id/invite` | Kirim invitation serius (setelah wali pria approve) |
| `PUT` | `/api/taaruf/connections/:id/wali-approve-invite` | Wali pria approve sebelum invitation terkirim |
| `PUT` | `/api/taaruf/connections/:id/invite-respond` | Wali wanita respond invitation |
| `PUT` | `/api/taaruf/connections/:id/confirm` | Konfirmasi final (4 pihak) |

---

## 10. Algoritma Resolve Wali (Traversal Pohon)

```
Input: user_id (wanita atau pria yang butuh wali)

1. Cari node user → nodes WHERE user_id = $1
2. Cari ayah:
   parent_child_relations WHERE child_node_id = node.id AND parent_type = 'father'
   → JOIN nodes → cek gender = 'male' AND user_id IS NOT NULL
   → return jika ada

3. Cari kakek (ayah dari ayah):
   Dari node ayah (langkah 2), cari parent_type = 'father' lagi
   → return jika ada

4. Cari saudara laki-laki kandung:
   Cari semua node yang punya parent yang sama (ayah DAN ibu sama)
   WHERE gender = 'male' AND user_id IS NOT NULL AND id != node.id
   → return yang paling tua (birth_date paling awal)

5. Cari saudara laki-laki seayah (beda ibu):
   Cari semua node yang punya ayah yang sama, ibu berbeda
   WHERE gender = 'male' AND user_id IS NOT NULL
   → return yang paling tua

6. Cari keponakan (anak laki-laki dari saudara kandung):
   Dari saudara kandung laki-laki (langkah 4), cari children mereka
   WHERE gender = 'male' AND user_id IS NOT NULL
   → return yang paling tua

7. Cari paman (saudara laki-laki ayah):
   Dari node kakek, cari children WHERE gender = 'male' AND id != ayah.id
   → return yang paling tua

8. Jika semua kosong → return null → tampil UI wali request/eksternal
```

---

## 11. Personality Test — Detail Pertanyaan (Contoh per Dimensi)

Setiap dimensi 6 pertanyaan, skala Likert 1–5
(1 = Sangat tidak setuju, 5 = Sangat setuju)

### Openness
1. Saya senang mencoba cara baru dalam menjalankan ibadah harian
2. Saya tertarik mendiskusikan ide-ide baru tentang cara mendidik anak
3. Ketika ada masalah keluarga, saya suka mencari perspektif baru
4. Saya nyaman jika rutinitas harian saya berubah
5. Saya suka mempelajari hal baru tentang agama dan kehidupan
6. Saya terbuka terhadap pendapat yang berbeda dari keluarga

### Conscientiousness
1. Saya merencanakan keuangan keluarga dengan teliti sebelum membelanjakan
2. Saya biasanya menyelesaikan tugas sebelum bersantai
3. Saya menjaga janji dan komitmen dengan konsisten
4. Rumah saya selalu dalam keadaan teratur dan rapi
5. Saya mempersiapkan diri jauh-jauh hari sebelum acara penting
6. Saya memiliki jadwal harian yang cukup terstruktur

### Extraversion
1. Setelah seharian bekerja, saya lebih suka berkumpul bersama keluarga besar
2. Saya merasa berenergi setelah bertemu banyak orang
3. Saya aktif memulai percakapan di acara keluarga
4. Saya lebih suka arisan keluarga daripada malam tenang di rumah
5. Saya mudah berkenalan dengan orang baru
6. Saya sering menjadi pusat percakapan dalam gathering

### Agreeableness
1. Saya memprioritaskan keharmonisan keluarga di atas pendapat saya sendiri
2. Saya mudah memaafkan anggota keluarga yang bersalah
3. Saya senang membantu orang lain meski tidak diminta
4. Saya jarang berkonflik dengan orang-orang di sekitar saya
5. Saya lebih suka berkompromi daripada mempertahankan pendapat
6. Saya peduli dengan perasaan orang lain sebelum berbicara

### Neuroticism
1. Saya sering merasa khawatir tentang masa depan keluarga
2. Saya sulit tidur ketika ada masalah yang belum terselesaikan
3. Saya mudah merasa tertekan ketika banyak tekanan dari luar
4. Emosi saya cukup stabil di berbagai situasi (reverse scored)
5. Saya sering memikirkan kesalahan masa lalu
6. Perubahan mendadak membuat saya merasa tidak nyaman

---

## 12. UI Screens yang Perlu Dibuat

| Screen | Komponen | Prioritas |
|---|---|---|
| Halaman penjelasan fitur | `TaarufExplainer.tsx` | Sprint 1 |
| Personality test | `PersonalityTest.tsx` | Sprint 1 |
| Form biodata (4 tab) | `TaarufProfileForm.tsx` (update) | Sprint 1 |
| Setup wali | `WaliSetupScreen.tsx` | Sprint 1 |
| Browse list | `TaarufBrowse.tsx` | Sprint 2 |
| Detail profil calon | `TaarufProfileDetail.tsx` | Sprint 2 |
| Kirim CV sheet | `SendCVSheet.tsx` | Sprint 2 |
| Status koneksi aktif | `ActiveConnectionCard.tsx` | Sprint 2 |
| Notifikasi wali (ada CV masuk) | `WaliInboxScreen.tsx` | Sprint 2 |
| Room chat pengenalan | `IntroChatRoom.tsx` | Sprint 3 |
| Request perpanjang | `ExtendChatSheet.tsx` | Sprint 3 |
| Kirim invitation serius | `InvitationScreen.tsx` | Sprint 4 |
| Konfirmasi final | `FinalConfirmScreen.tsx` | Sprint 4 |

---

## 13. Cron Jobs

| Job | Jadwal | Fungsi |
|---|---|---|
| `expire-intro-chats` | Setiap jam | Cek `intro_chat_expires_at < NOW()`, update status → `intro_chat_expired`, soft-delete room |
| `cleanup-taaruf-chats` | Harian 03:00 UTC | Hard-delete pesan chat expired > 7 hari |
| `reset-daily-view-credits` | Harian 00:00 WIB | Reset `daily_view_count = 0` untuk semua profil |
| `notify-chat-expiring` | Harian 09:00 UTC | Notifikasi ke user yang chat-nya akan expired dalam 2 hari |

---

## 14. Pertanyaan Terbuka yang Sudah Dijawab

| Pertanyaan | Keputusan |
|---|---|
| Usia minimum | 18 tahun |
| Test personality | Hybrid Big Five + konteks Islam, update setelah 6 bulan |
| Profil orang tua | Pull otomatis dari pohon + tambah hobi, bisa override manual |
| Kondisi kesehatan | Opsional, hanya visible setelah CV diterima |
| Limit browse | 5 profil detail per hari (list thumbnail bebas) |
| Setelah ditolak | Langsung aktif lagi (tidak ada cooling period) |
| Wali pria | Notifikasi saat CV kirim, approve saat invitation serius (Opsi B) |
| Perpanjang chat | +1 minggu, hanya 1x, kedua pihak harus setuju |
| Wali tidak ada di pohon | Request user platform → atau wali administrasi eksternal |
| Chat expired | Soft delete → 7 hari → hard delete |

## 15. Yang Belum Diputuskan

| # | Pertanyaan |
|---|---|
| 1 | Apakah ada fitur premium berbayar (konsultasi konselor) di dalam ta'aruf ini? Atau terpisah? |
| 2 | Bagaimana jika wali meninggal/tidak aktif saat proses berjalan? |
| 3 | Apakah profil bisa di-hide sementara tanpa dihapus? |
| 4 | Apakah ada fitur "bookmark" profil sebelum buka detail (tidak pakai kredit)? |
