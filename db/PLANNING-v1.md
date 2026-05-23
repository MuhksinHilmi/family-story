# Family Story - Database Redesign Planning v1
**Tanggal**: 23 Mei 2026  
**Status**: Planning Phase (belum diimplementasi)

---

## 1. Latar Belakang & Alasan Redesign

Model lama (`family_id` + `family_nodes` + `spouse_relations` yang terikat ke satu family) terlalu kaku untuk kasus:
- Dua orang dari pohon keluarga berbeda ingin menikah.
- Visualisasi jaringan silsilah yang "sambung-menyambung" (besan, ipar, dll).
- Aturan kultur Indonesia (anak mengikuti ayah, istri mengikuti suami, anak yang menikah keluar dari family orang tua).

Kami memutuskan untuk **rombak total** karena masih development dan ingin versi yang bersih serta sustainable.

---

## 2. Model Baru yang Disepakati (Hybrid)

### 2.1 Global Relationship Graph (untuk Visualisasi)
- **Node** = representasi orang di jaringan silsilah.
- Relasi utama:
  - `marriages` (dengan status: married / divorced / widowed + tanggal)
  - `parent_child_relations`
- Visualisasi tree = traversal graph dari node user yang login.
- Tidak ada batas permission keras. Siapa yang terhubung lewat rantai relasi bisa saling melihat jaringan.
- Privacy hanya pada data pribadi (no telp, tgl lahir) — user bisa atur public/private. Data relationship (pasangan & anak) **wajib public**.

### 2.2 Nuclear Family / Household (untuk Kultur + Chat + Dokumen)
- `nuclear_families` = unit keluarga inti (mirip Kartu Keluarga).
- `nuclear_family_memberships` = riwayat keanggotaan (1 orang hanya 1 active family dalam satu waktu).
- Aturan keanggotaan:
  - Pria + Wanita menikah → buat `nuclear_family` baru, keduanya jadi member.
  - Anak lahir → masuk ke family ayah.
  - Anak (laki-laki atau perempuan) menikah → **keluar** dari family orang tua + masuk family baru.
- `family_membership` bersifat **temporal** (ada `joined_at` dan `left_at`).

### 2.3 Chat Membership Bersifat "Sticky" (Terpisah dari Active Family)
- Keanggotaan chat room **tidak otomatis keluar** ketika seseorang meninggalkan nuclear family.
- Contoh: Anak perempuan menikah keluar dari family ayah.
  - Dia tetap berada di chat room family ayah (history).
  - Dia juga ditambahkan ke chat room nuclear family barunya.
- Ini berbeda dengan `nuclear_family_memberships` yang aktif hanya 1.

### 2.4 Invitation & Onboarding
- Hanya boleh membuat node sendiri (saat register atau saat di-invite).
- Tidak ada admin yang bisa menambah node sembarangan.
- Cara undang:
  - Via link (pakai `node.uuid` + token)
  - Atau ketik UUID user/node lalu pilih tipe hubungan (pasangan / anak)
- `nodes.uuid` dan `nuclear_families.uuid` digunakan untuk referensi aman (terutama untuk koneksi ke Supabase chat nanti).

---

## 3. Tabel Inti (Clean Schema v1)

Lokasi draft: `db/schema/2026-clean/init.sql`

| Tabel                          | UUID? | Keterangan |
|--------------------------------|-------|----------|
| `users`                        | Ya    | Akun login + OTP + activation |
| `nodes`                        | Ya    | Entitas orang di graph (target undangan) |
| `marriages`                    | Tidak | Record pernikahan + status + history (support remarriage) |
| `parent_child_relations`       | Tidak | Relasi orang tua - anak |
| `nuclear_families`             | Ya    | Unit keluarga inti (KK) |
| `nuclear_family_memberships`   | -     | Riwayat keanggotaan + history |
| `invitations`                  | Ya    | 3 cara undang (ketik ID, ketik email, share link + expired) |
| `nodes.current_nuclear_family_id` | -  | Denormalized untuk query cepat |
| `nodes.current_marriage_id`    | -     | Untuk akses cepat pasangan aktif |

**Catatan penting**:
- `marriages` dan `parent_child_relations` **tidak** pakai UUID.
- UUID saat ini ada di: `users`, `nodes`, `nuclear_families`, dan `invitations`.
- Tabel `invitations` mendukung 3 metode undangan sesuai requirement:
  - Ketik public node/user ID
  - Ketik email (untuk yang belum register)
  - Share link (UUID + token, expired + one-time use)

---

## 4. Keputusan Penting yang Sudah Dikunci

1. **Tidak ada admin role** — pure relationship driven.
2. **Privacy selective** — hanya data pribadi yang bisa disembunyikan.
3. **Anak keluar dari family orang tua** saat menikah (baik laki-laki maupun perempuan).
4. **Chat sticky** — membership chat terpisah dari active family membership.
5. **Supabase** (messages realtime) dibiarkan dulu, hanya local Postgres yang dirombak.
6. **Visualisasi** menggunakan graph traversal, bukan berdasarkan nuclear_family.
7. **Dokumen** bisa di-transfer antar nuclear family.

---

## 5. Struktur Folder Setelah Archiving (23 Mei 2026)

```
db/
├── archive/
│   └── 2026-05-23-legacy-local-db/
│       ├── init.sql          ← schema lama (sebelum redesign)
│       └── migrations/       ← semua migration lama
├── schema/
│   └── 2026-clean/
│       └── init.sql          ← draft schema baru (v1)
├── supabase/                 ← dibiarkan (tidak dirombak)
└── PLANNING-v1.md            ← dokumentasi ini
```

---

## 6. Status Saat Ini (23 Mei 2026)

- [x] Diskusi panjang & klarifikasi requirement selesai
- [x] Model hybrid disepakati
- [x] Draft schema v1 dibuat + beberapa kali revisi
- [x] UUID ditambahkan pada `nodes`, `nuclear_families`, dan `invitations`
- [x] Tabel `invitations` ditambahkan (mendukung 3 cara undang: ketik ID, ketik email, share link)
- [x] Old local schema di-archive ke `db/archive/2026-05-23-legacy-local-db/`
- [x] Dokumentasi planning dibuat
- [x] Review awal schema + perbaikan (current_* columns, users auth fields, marriages constraint, dll)
- [ ] Finalisasi penuh schema v1
- [ ] Strategi drop local database (`family_story`) + menjalankan init baru
- [ ] Implementasi bertahap (mulai dari nodes + relationships + invitations)

---

## 7. Next Steps (per 23 Mei 2026)

1. Finalisasi penuh `db/schema/2026-clean/init.sql` (review + tambahan kecil jika perlu).
2. Siapkan rencana drop local database + menjalankan init baru (termasuk backup).
3. Buat dokumentasi tambahan jika diperlukan (contoh: `INVITATION-FLOW.md`).
4. Mulai implementasi bertahap:
   - Nodes + Relationships (marriages & parent_child)
   - Nuclear Families + Memberships
   - Invitations + flow register via undangan
   - Tree visualization (graph traversal)
5. Setelah core tree stabil, baru bahas chat, documents, dan feeds.

---

**Catatan untuk developer selanjutnya**:
Semua keputusan besar sudah didokumentasikan di file ini. Jangan kembali ke model lama (`family_id` di family_nodes + spouse_relations) tanpa diskusi ulang. Model baru ini dirancang untuk mendukung jaringan silsilah yang kompleks sekaligus tetap menghormati aturan keluarga Indonesia.

---
---

## 8. Rencana Drop Local Database & Menjalankan Init Baru (Draft)

**Peringatan**: Langkah ini **destructive**. Pastikan sudah backup.

### Cara yang Paling Aman (Direkomendasikan)

Gunakan script berikut yang sudah dilengkapi dengan **banyak konfirmasi** dan backup otomatis:

```bash
./db/scripts/safe-clean-reset.sh
```

Script ini akan:
- Memeriksa apakah aplikasi sedang berjalan
- Membuat backup dengan timestamp otomatis ke `~/family_story_backups/`
- Meminta konfirmasi **dua kali** (termasuk ketik "DELETE" dan nama database)
- Hanya kemudian melakukan drop + recreate + menjalankan schema baru
- Memberikan verifikasi di akhir

### Alternatif Manual (jika tidak pakai script)

Ikuti langkah-langkah di bagian atas script secara manual dengan sangat hati-hati.

### Catatan Penting

- Ini adalah **full clean start** — semua data lama akan hilang.
- Supabase (realtime messages) **tidak** direset.
- Setelah reset berhasil, kita bisa mulai implementasi dari nol dengan schema yang bersih.

**Status rencana ini**: Masih draft. Akan disempurnakan setelah user konfirmasi siap drop.

---

*Dokumen ini dibuat otomatis berdasarkan diskusi 20–23 Mei 2026. Diupdate terakhir: 23 Mei 2026.*
