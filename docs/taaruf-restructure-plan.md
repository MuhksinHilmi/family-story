# Planning: Restructure Fitur Ta'aruf
**Status:** Draft — siap untuk review sebelum implementasi  
**Tanggal:** September 2026

---

## 1. Visi & Pembeda Utama

Ta'aruf di CeritaKeluarga bukan sekadar matching app. Pembedanya:

1. **Keluarga terlibat dari awal** — bukan hanya saat lamaran
2. **Sistem wali berbasis pohon keluarga** — mencari otomatis berdasarkan relasi fiqih
3. **Chat pengenalan melibatkan dua keluarga inti**, bukan hanya dua orang
4. **Kedua calon tidak pernah berdua** di chat — selalu ada keluarga/wali di room yang sama
5. **Chat pengenalan bersifat sementara** — expired otomatis, bukan beban relasi permanen

---

## 2. Konsep Wali

### Hierarki pencarian wali (urutan fiqih standar)

Sistem mencari otomatis dari pohon keluarga berdasarkan urutan ini:

```
1. Ayah kandung
2. Kakek (ayah dari ayah)
3. Saudara laki-laki kandung (seayah seibu)
4. Saudara laki-laki seayah (beda ibu)
5. Anak laki-laki dari saudara kandung (keponakan laki-laki)
6. Paman dari jalur ayah (saudara laki-laki ayah)
```

Semua dari pohon keluarga → pasti sudah punya akun.

### Jika tidak ada di pohon keluarga

**Langkah 1 — Request ke user platform:**  
User memilih sendiri seseorang yang terdaftar di platform (teman, kenalan) → orang itu dapat notifikasi dan bisa accept/decline sebagai wali.

**Langkah 2 — Wali administrasi (jika tidak ada sama sekali):**  
User menambahkan wali secara manual: nama + nomor HP/email saja. Tidak punya akun, tidak bisa interaksi di sistem. Platform hanya mencatat bahwa wali sudah dikonfirmasi di luar platform. Proses ta'aruf tetap berjalan dengan flag `wali_type = 'external'`.

### Wali untuk pria

Pria bisa bergerak lebih aktif (browsing, kirim CV) tapi tetap butuh wali untuk:
- Approve pengiriman CV ke calon
- Konfirmasi final invitation serius
- Hadir di room chat pengenalan (mewakili keluarga pria)

Hierarki sama, tapi pria umumnya bertindak lebih mandiri dalam fiqih — implementasinya: approval wali pria bisa di-skip jika pria sudah berusia di atas threshold tertentu (ditentukan saat implementasi), dengan catatan tetap ternotifikasi.

---

## 3. State Machine Lengkap

### Status profil ta'aruf

```
draft → active → in_process → serius → married
                     ↓
                  single (jika ditolak/expired)
```

- `draft` — profil belum lengkap
- `active` — profil aktif, bisa di-browse
- `in_process` — sedang dalam chat pengenalan dengan seseorang
- `serius` — kedua pihak dan wali sudah konfirmasi lanjut ke pernikahan
- `married` — pernikahan dikonfirmasi, profil ditutup permanen
- `single` — kembali ke status bisa browse setelah ditolak/expired

### Status koneksi ta'aruf (antara dua profil)

```
proposed → cv_reviewed → cv_accepted → intro_chat_active
                ↓                            ↓
           cv_rejected                  invitation_sent
                                             ↓
                                     invitation_accepted (= serius)
                                             ↓
                                     nikah_confirmed (= married)
                                             ↓
                                       rejected / expired
                                     (kembali ke single)
```

---

## 4. Alur Lengkap

### Fase 1 — Browsing & Proposal CV

```
User (pria/wanita) buka ta'aruf
    ↓
Sistem cek: usia cukup? profil lengkap? belum punya spouse? belum in_process?
    ↓
Browse profil calon (hanya lihat info publik: nama inisial, usia, kota, pendidikan, minat)
    ↓
Tertarik → "Ajukan ke Wali"
    ↓
Sistem cari wali otomatis (urutan fiqih)
    → Wali ditemukan di pohon keluarga? → notifikasi ke wali
    → Tidak ada? → user request ke user lain / tambah wali administrasi
    ↓
Wali lihat profil lengkap calon
    ↓
Wali: Approve / Decline
    ↓ (jika approve)
CV + profil lengkap terkirim ke pihak calon
```

### Fase 2 — Review dari Pihak Calon

```
Pihak calon (anak + walinya) mendapat notifikasi "Ada yang tertarik"
    ↓
Wali calon lihat profil pengirim
    ↓
Wali calon + anak calon berdiskusi (di luar sistem, atau di notifikasi internal)
    ↓
Wali calon: Terima / Tolak
    ↓ (jika terima)
Room chat pengenalan dibuat → Fase 3
    ↓ (jika tolak)
Status koneksi = cv_rejected
Pengirim dapat notifikasi "Belum cocok kali ini" (tanpa alasan detail, jaga privasi)
Profil pengirim kembali ke status active (bisa browse lagi)
```

### Fase 3 — Chat Pengenalan Keluarga

```
Room chat dibuat dengan anggota:
    - Calon pria
    - Wali pria (ayah / yang ditunjuk)
    - Anggota keluarga inti pria lainnya (opsional, bisa join)
    - Calon wanita
    - Wali wanita (ayah / yang ditunjuk)
    - Anggota keluarga inti wanita lainnya (opsional, bisa join)

Aturan chat:
    - Calon pria TIDAK BISA kirim pesan langsung ke calon wanita
      (hanya bisa kirim ke room secara kolektif)
    - Calon wanita TIDAK BISA kirim pesan langsung ke calon pria
    - Wali & keluarga bisa chat bebas di room

Durasi: 2 minggu
    ↓
Sebelum expired:
    - Salah satu pihak bisa request perpanjang 1x (1 minggu tambahan)
    - Harus disetujui kedua pihak
    ↓
Jika expired tanpa keputusan:
    - Room otomatis ditutup & dihapus (soft delete, data chat tidak disimpan)
    - Status koneksi = expired
    - Kedua profil kembali ke active (bisa browse lagi)
    ↓
Selama chat aktif → konsultasi konselor bisa diakses (premium)
```

### Fase 4 — Invitation Serius

```
Jika kedua pihak sepakat lanjut:
    ↓
Pria (atau walinya) kirim "Undangan Serius" ke pihak wanita
    ↓
Wali wanita mendapat notifikasi (bukan langsung ke wanita)
Wali wanita lihat undangan → berdiskusi dengan anaknya
    ↓
Wali wanita: Accept / Decline
    ↓ (jika decline)
Status koneksi = rejected
Kedua profil kembali ke active
Room chat tetap ada sampai expired alami
    ↓ (jika accept)
Konfirmasi final → tampil summary ke kedua calon + kedua wali:
"Dengan ini proses ta'aruf berlanjut ke tahap serius.
 Hubungan ini akan dicatat di pohon keluarga setelah nikah dikonfirmasi."
Kedua pihak klik "Konfirmasi Final"
    ↓
Status koneksi = serius
Status profil kedua calon = serius (tidak bisa browse/terima CV baru)
Room chat pengenalan TIDAK dihapus — dikonversi jadi room permanen (arsip keluarga)
Konsultasi konselor: diprioritaskan/ditawarkan lebih kuat
```

### Fase 5 — Konfirmasi Nikah

```
Nikah terjadi (di luar platform, atau via fitur dokumen)
    ↓
Salah satu pihak input konfirmasi nikah di sistem
    ↓
Persetujuan kedua wali (opsional tapi recommended)
    ↓
Sistem update:
    - Buat record marriages
    - Buat nuclear_family baru
    - Update nodes kedua calon
    - Status profil ta'aruf = married (closed)
    - Room chat pengenalan = permanen (milik keluarga besar gabungan)
```

---

## 5. Schema Database (Baru / Restructure)

### Tabel yang dipertahankan dengan modifikasi

#### `taaruf_profiles` — tambah kolom

```sql
ALTER TABLE taaruf_profiles
  ADD COLUMN status VARCHAR(20) DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'in_process', 'serius', 'married', 'single')),
  ADD COLUMN wali_user_id INTEGER REFERENCES users(id),      -- wali yang sudah resolve
  ADD COLUMN wali_type VARCHAR(20)
    CHECK (wali_type IN ('family_tree', 'platform_user', 'external')),
  ADD COLUMN wali_external_name TEXT,       -- jika wali_type = external
  ADD COLUMN wali_external_contact TEXT,    -- HP/email wali eksternal
  ADD COLUMN wali_confirmed_at TIMESTAMPTZ,
  ADD COLUMN min_age_override INTEGER,      -- set oleh orang tua jika perlu
  ADD COLUMN is_wali_approved BOOLEAN DEFAULT false;
```

#### `taaruf_applications` — ganti nama + restructure status

Tabel ini diubah jadi `taaruf_connections` untuk mencerminkan sifatnya yang lebih dari sekadar "lamaran":

```sql
CREATE TABLE taaruf_connections (
  id                    SERIAL PRIMARY KEY,
  initiator_profile_id  INTEGER NOT NULL REFERENCES taaruf_profiles(id),
  recipient_profile_id  INTEGER NOT NULL REFERENCES taaruf_profiles(id),

  -- Status perjalanan koneksi
  status VARCHAR(30) NOT NULL DEFAULT 'proposed'
    CHECK (status IN (
      'proposed',           -- CV sudah dikirim, menunggu wali initiator approve
      'wali_approved',      -- wali initiator approve, CV terkirim ke calon
      'cv_reviewed',        -- pihak calon & wali sedang review
      'cv_accepted',        -- wali calon terima → room chat dibuat
      'cv_rejected',        -- wali calon tolak
      'intro_chat_active',  -- chat pengenalan sedang berjalan
      'intro_chat_expired', -- chat expired tanpa keputusan
      'invitation_sent',    -- undangan serius dikirim pria
      'serius',             -- kedua wali konfirmasi → lanjut ke nikah
      'rejected',           -- undangan serius ditolak
      'married',            -- nikah dikonfirmasi
      'cancelled'           -- dibatalkan salah satu pihak
    )),

  -- Pesan dari initiator ke wali calon (CV cover letter)
  intro_message         TEXT,          -- min 20 karakter

  -- Chat room pengenalan
  intro_chat_room_id    UUID REFERENCES chat_rooms(id),
  intro_chat_expires_at TIMESTAMPTZ,   -- 2 minggu dari created, +1 minggu jika extended
  intro_chat_extended   BOOLEAN DEFAULT false,
  extend_requested_by   INTEGER REFERENCES users(id), -- siapa yang request perpanjang

  -- Invitation serius
  invitation_message    TEXT,
  invitation_sent_at    TIMESTAMPTZ,
  invitation_responded_at TIMESTAMPTZ,

  -- Konfirmasi final
  initiator_confirmed   BOOLEAN DEFAULT false,
  recipient_confirmed   BOOLEAN DEFAULT false,
  confirmed_at          TIMESTAMPTZ,

  -- Hasil akhir
  chat_room_id          UUID REFERENCES chat_rooms(id), -- room permanen setelah serius
  marriage_id           INTEGER REFERENCES marriages(id),

  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(initiator_profile_id, recipient_profile_id)
);

CREATE INDEX idx_taaruf_connections_initiator ON taaruf_connections(initiator_profile_id);
CREATE INDEX idx_taaruf_connections_recipient ON taaruf_connections(recipient_profile_id);
CREATE INDEX idx_taaruf_connections_status    ON taaruf_connections(status);
CREATE INDEX idx_taaruf_connections_expires   ON taaruf_connections(intro_chat_expires_at)
  WHERE status = 'intro_chat_active';
```

### Tabel baru: `taaruf_wali_requests`

Untuk kasus wali dari platform user (bukan keluarga pohon):

```sql
CREATE TABLE taaruf_wali_requests (
  id              SERIAL PRIMARY KEY,
  profile_id      INTEGER NOT NULL REFERENCES taaruf_profiles(id),
  requested_user_id INTEGER NOT NULL REFERENCES users(id), -- yang diminta jadi wali
  status          VARCHAR(20) DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined')),
  message         TEXT,        -- pesan penjelasan dari user
  responded_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### Tabel baru: `taaruf_chat_extend_requests`

```sql
CREATE TABLE taaruf_chat_extend_requests (
  id              SERIAL PRIMARY KEY,
  connection_id   INTEGER NOT NULL REFERENCES taaruf_connections(id),
  requested_by    INTEGER NOT NULL REFERENCES users(id),
  other_party_response VARCHAR(10)
    CHECK (other_party_response IN ('pending', 'accepted', 'declined')),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### Tabel yang dihapus / digantikan

- `taaruf_applications` → digantikan oleh `taaruf_connections`
- `taaruf_criteria` → tetap ada, tidak berubah

---

## 6. API Endpoints Baru

### Wali

| Method | Endpoint | Fungsi |
|---|---|---|
| `GET` | `/api/taaruf/wali` | Resolve wali otomatis dari pohon keluarga |
| `POST` | `/api/taaruf/wali/request` | Request user lain jadi wali |
| `PUT` | `/api/taaruf/wali/request/:id` | Accept/decline wali request |
| `POST` | `/api/taaruf/wali/external` | Tambah wali administrasi eksternal |

### Connections (gantikan applications)

| Method | Endpoint | Fungsi |
|---|---|---|
| `POST` | `/api/taaruf/connections` | Kirim CV (status: proposed) |
| `PUT` | `/api/taaruf/connections/:id/wali-approve` | Wali initiator approve CV |
| `PUT` | `/api/taaruf/connections/:id/cv-respond` | Wali calon terima/tolak CV |
| `PUT` | `/api/taaruf/connections/:id/extend` | Request perpanjang chat |
| `PUT` | `/api/taaruf/connections/:id/extend-respond` | Pihak lain respond extend |
| `POST` | `/api/taaruf/connections/:id/invite` | Kirim undangan serius |
| `PUT` | `/api/taaruf/connections/:id/invite-respond` | Wali calon respond undangan |
| `PUT` | `/api/taaruf/connections/:id/confirm` | Konfirmasi final kedua pihak |
| `GET` | `/api/taaruf/connections` | List koneksi aktif user |

### Profile & Status

| Method | Endpoint | Fungsi |
|---|---|---|
| `GET` | `/api/taaruf` | Status lengkap (sama seperti sekarang, diextend) |
| `POST` | `/api/taaruf` | Buat/update profil |
| `PATCH` | `/api/taaruf/status` | Update status profil (hide, reactive) |

### Cron Jobs (background)

| Job | Schedule | Fungsi |
|---|---|---|
| `expire-intro-chats` | Setiap jam | Cek koneksi yang `intro_chat_expires_at < now()`, update status → `intro_chat_expired`, soft delete chat room |
| `cleanup-expired-rooms` | Harian jam 03:00 | Hard delete pesan chat yang sudah expired > 7 hari |

---

## 7. Logika Resolve Wali Otomatis

Query traversal pohon keluarga (urutan fiqih):

```sql
-- Untuk wanita dengan user_id = $userId
WITH user_node AS (
  SELECT id, gender FROM nodes WHERE user_id = $userId LIMIT 1
)
SELECT
  n.id as wali_node_id,
  n.user_id as wali_user_id,
  u.full_name,
  CASE
    WHEN pcr.parent_type = 'father' AND depth = 1 THEN 1  -- ayah
    WHEN pcr.parent_type = 'father' AND depth = 2 THEN 2  -- kakek dari ayah
    WHEN is_sibling AND share_father = true THEN 3         -- saudara kandung
    WHEN is_sibling AND share_father = false THEN 4        -- saudara seayah
    WHEN is_nephew THEN 5                                   -- keponakan
    WHEN is_uncle THEN 6                                    -- paman dari ayah
  END as wali_priority
FROM ... (traversal logic)
WHERE n.gender = 'male'
  AND u.id IS NOT NULL  -- sudah punya akun
ORDER BY wali_priority ASC
LIMIT 1;
```

Jika query return kosong → tampil UI untuk request wali dari platform atau tambah wali eksternal.

---

## 8. Aturan Chat Pengenalan

Room dibuat dengan tipe `taaruf_intro`:

```
Anggota wajib:
  - Calon pria (role: candidate)
  - Wali pria (role: wali)
  - Calon wanita (role: candidate)
  - Wali wanita (role: wali)

Anggota opsional (bisa join):
  - Anggota keluarga inti pria (role: family)
  - Anggota keluarga inti wanita (role: family)

Permission per role:
  candidate → bisa kirim pesan ke room (ke semua, tidak ada DM)
  wali      → bisa kirim, bisa approve perpanjang, bisa kirim invitation
  family    → bisa kirim, read-only untuk data profil
```

Pembatasan DM antara calon:
- Di level aplikasi, tidak ada fitur DM di room taaruf_intro
- Semua pesan visible ke semua anggota room

---

## 9. Yang Perlu Diubah dari Implementasi Lama

| File | Perubahan |
|---|---|
| `db/schema/.../015_create_taaruf.sql` | Tidak diubah, tambah migration baru |
| `db/schema/.../022_restructure_taaruf.sql` | **Baru** — taaruf_connections, taaruf_wali_requests, taaruf_chat_extend_requests, alter taaruf_profiles |
| `src/app/api/taaruf/route.ts` | Update GET response (tambah wali info, connections), POST tetap mirip |
| `src/app/api/taaruf/applications/` | **Hapus** — digantikan oleh `/api/taaruf/connections/` |
| `src/app/api/taaruf/connections/` | **Baru** — semua endpoint connections |
| `src/app/api/taaruf/wali/` | **Baru** — resolve, request, external |
| `src/app/taaruf/page.tsx` | Update state machine (tambah state wali pending, chat active) |
| `src/app/taaruf/hooks/useTaaruf.ts` | Update interface, tambah wali actions |
| `src/app/taaruf/components/WaitingScreen.tsx` | Perbarui untuk status baru (wali pending, chat active, dll) |
| `src/app/taaruf/components/MatchedChatRoom.tsx` | Tambah room role enforcement (no DM antar calon) |
| `src/app/taaruf/components/` | Tambah: `WaliSetupScreen.tsx`, `IntroChatRoom.tsx`, `InvitationScreen.tsx` |

---

## 10. Fase Implementasi (Sprint)

### Sprint 1 — Database & Wali System
- [ ] Migration 022: tabel baru + alter taaruf_profiles
- [ ] `GET /api/taaruf/wali` — resolve otomatis dari pohon
- [ ] `POST /api/taaruf/wali/request` + `PUT .../request/:id`
- [ ] `POST /api/taaruf/wali/external`
- [ ] UI: `WaliSetupScreen.tsx`

### Sprint 2 — Connections & CV Flow
- [ ] `POST /api/taaruf/connections` — kirim CV
- [ ] `PUT .../wali-approve` — wali initiator approve
- [ ] `PUT .../cv-respond` — wali calon respond
- [ ] Update `page.tsx` state machine
- [ ] UI: update `SwipeDeck` + `ConfirmSheet` untuk flow baru

### Sprint 3 — Chat Pengenalan
- [ ] Buat room taaruf_intro dengan permission roles
- [ ] UI: `IntroChatRoom.tsx` (no DM enforcement)
- [ ] Cron job expire-intro-chats
- [ ] `PUT .../extend` + `PUT .../extend-respond`

### Sprint 4 — Invitation Serius & Konfirmasi Nikah
- [ ] `POST .../invite` + `PUT .../invite-respond`
- [ ] `PUT .../confirm` (konfirmasi final)
- [ ] Update pohon keluarga (marriages, nuclear_family)
- [ ] UI: `InvitationScreen.tsx`
- [ ] Konversi room intro → room permanen

### Sprint 5 — Polish & Konselor Premium
- [ ] Integrasi trigger konselor saat status = `serius`
- [ ] Notifikasi per stage (wali, cv_accepted, invitation, dll)
- [ ] Cron cleanup expired rooms
- [ ] Cooling period setelah rejected (opsional)

---

## 11. Pertanyaan Terbuka (Perlu Diputuskan Sebelum Implementasi)

| # | Pertanyaan |
|---|---|
| 1 | Batas usia minimum untuk akses ta'aruf? Siapa yang bisa set (orang tua di profil anak)? |
| 2 | Apakah pria juga butuh approval wali sebelum kirim CV, atau wali pria hanya dinotifikasi? |
| 3 | Cooling period setelah ditolak — berapa lama sebelum profil bisa browse lagi? |
| 4 | Apakah ada batas maksimum koneksi aktif per user di waktu yang sama? |
| 5 | Apa yang terjadi jika wali meninggal/tidak aktif saat proses sedang berjalan? |
