# Ringkasan Implementasi Fitur Ta'aruf
**Terakhir diperbarui:** September 2026  
**Status keseluruhan:** Fungsional — semua alur utama sudah berjalan

---

## 1. Gambaran Umum

Ta'aruf adalah fitur pencarian pasangan Islami yang terintegrasi dengan pohon keluarga. Fitur ini hanya bisa diakses oleh user yang **belum memiliki spouse aktif** di sistem.

Ketika lamaran diterima, sistem otomatis:
- Membuat pernikahan (`marriages`)
- Membuat nuclear_family baru untuk pasangan
- Membuat chat room ta'aruf dan mengundang keluarga inti kedua pihak
- Mengirim system message pembuka di chat room

---

## 2. Database Schema

### Tabel: `taaruf_profiles`
```sql
id                SERIAL PRIMARY KEY
user_id           INTEGER REFERENCES users(id)
node_id           INTEGER REFERENCES nodes(id)
full_name         VARCHAR(255)
age               INTEGER
location          TEXT
education_level   VARCHAR(100)
occupation        TEXT
about_me          TEXT
interests         TEXT[]
photo_url         TEXT
cover_photo       TEXT
status            VARCHAR(20) -- 'draft' | 'active' | 'matched' | 'closed' | 'hidden'
created_at        TIMESTAMPTZ
updated_at        TIMESTAMPTZ
```

### Tabel: `taaruf_criteria`
```sql
id                        SERIAL PRIMARY KEY
profile_id                INTEGER REFERENCES taaruf_profiles(id)
age_min                   INTEGER
age_max                   INTEGER
preferred_education       VARCHAR(100)[]
preferred_location        TEXT
preferred_marital_status  VARCHAR(20) -- 'never_married' | 'divorced' | 'widowed'
max_distance              INTEGER
created_at                TIMESTAMPTZ
updated_at                TIMESTAMPTZ
```

### Tabel: `taaruf_applications`
```sql
id                   SERIAL PRIMARY KEY
sender_profile_id    INTEGER REFERENCES taaruf_profiles(id)
recipient_profile_id INTEGER REFERENCES taaruf_profiles(id)
message              TEXT                  -- pesan dari pria (min 20 karakter)
letters              JSONB                 -- opsional, belum dipakai
status               VARCHAR(20)           -- 'pending' | 'accepted' | 'rejected' | 'withdrawn' | 'cancelled'
response_message     TEXT                  -- pesan balasan dari wanita (min 20 karakter)
created_at           TIMESTAMPTZ
responded_at         TIMESTAMPTZ
chat_room_id         UUID REFERENCES chat_rooms(id)  -- diisi saat accepted
UNIQUE(sender_profile_id, recipient_profile_id)
```

### Tabel: `room_memberships` *(dibuat di migration 015)*
```sql
chat_room_id  UUID REFERENCES chat_rooms(id)
user_id       INTEGER REFERENCES users(id)
created_at    TIMESTAMPTZ
PRIMARY KEY (chat_room_id, user_id)
```

---

## 3. API Routes

### `GET /api/taaruf`
Mengambil status ta'aruf lengkap untuk user yang sedang login.

**Response:**
```json
{
  "has_spouse": false,
  "spouse": null,
  "gender": "male",
  "my_profile": { ...TaarufProfile, criteria: {...} },
  "outgoing_application": null,
  "incoming_applications": [],
  "matched_room": null,
  "available_profiles": [ ...TaarufProfile[] ]
}
```

**Logic:**
- Cek `marriages` — apakah user sudah punya spouse aktif
- Ambil profil ta'aruf + kriteria via JOIN
- Jika laki: ambil outgoing application (`pending` atau `accepted`)
- Jika perempuan: ambil semua incoming applications (`pending`)
- Jika ada match: ambil chat_room dari accepted application
- Jika laki & profile aktif & belum apply: ambil `available_profiles` (wanita aktif, belum pernah di-apply, belum menikah, profil lengkap) — `ORDER BY RANDOM() LIMIT 20`

---

### `POST /api/taaruf`
Buat atau update profil ta'aruf. Status otomatis di-set ke `'active'`.

**Request body:**
```json
{
  "location": "Jakarta",
  "education_level": "S1",
  "occupation": "Software Engineer",
  "about_me": "...",
  "interests": ["membaca", "memasak"],
  "photo_url": "...",
  "cover_photo": "...",
  "criteria": {
    "age_min": 22,
    "age_max": 30,
    "preferred_education": ["S1", "S2"],
    "preferred_location": "Jakarta",
    "preferred_marital_status": "Belum Menikah"
  }
}
```

**Logic:** Upsert `taaruf_profiles` + upsert `taaruf_criteria`. Field `full_name` diambil otomatis dari `nodes`.

---

### `POST /api/taaruf/applications`
Laki-laki kirim lamaran ta'aruf.

**Request body:**
```json
{
  "recipient_profile_id": 42,
  "message": "Assalamu'alaikum, perkenalkan saya..."
}
```

**Business rules yang di-enforce:**
- Profil pengirim harus `active`
- Pesan minimal 20 karakter
- Hanya boleh punya 1 lamaran `pending` aktif
- Tidak bisa lamar profil yang sama dua kali (`UNIQUE` constraint)
- Profil penerima harus `active`

---

### `PUT /api/taaruf/applications/[id]`
Wanita menerima atau menolak lamaran.

**Request body:**
```json
{
  "action": "accept",
  "response_message": "Wa'alaikumsalam, dengan senang hati..."
}
```

**Business rules yang di-enforce:**
- `response_message` minimal 20 karakter
- Hanya penerima lamaran yang bisa respond
- Lamaran harus berstatus `pending`

**Saat `accept` — chain of events (dalam satu transaksi):**
1. Update application status → `accepted`
2. Cancel semua lamaran `pending` lain dari sender (pria hanya boleh 1 aktif)
3. Cancel semua lamaran `pending` lain ke recipient (wanita hanya terima 1)
4. Buat record `marriages` dengan status `married`
5. Buat `chat_rooms` scope `small` untuk ta'aruf
6. Insert `room_memberships` untuk sender + recipient
7. Insert `room_memberships` untuk nuclear family sender (jika ada)
8. Insert `room_memberships` untuk nuclear family recipient (jika ada)
9. Update `taaruf_applications.chat_room_id`
10. Update `nodes.current_marriage_id`
11. Buat `nuclear_families` baru untuk pasangan baru
12. Insert `nuclear_family_memberships` — sender sebagai `head`, recipient sebagai `spouse`
13. Update `nodes.current_nuclear_family_id` untuk kedua node
14. Kirim system message pembuka di chat room

---

## 4. Frontend — State Machine

```
mount → GET /api/taaruf
  ↓
has_spouse = true       → Tampil info pasangan (halaman tertutup)
my_profile tidak lengkap → <TaarufProfileForm />
gender = male
  ├── matched_room ada  → <MatchedChatRoom />
  ├── outgoing pending  → <WaitingScreen />
  └── default           → <SwipeDeck mode="browse" />
gender = female
  ├── matched_room ada  → <MatchedChatRoom />
  ├── incoming ada      → <SwipeDeck mode="review" />
  └── default           → <EmptyInbox />
```

---

## 5. Komponen Frontend

| Komponen | File | Status | Fungsi |
|---|---|---|---|
| Gate & Router | `page.tsx` | ✅ Done | State machine, routing ke komponen yang tepat |
| Hook utama | `hooks/useTaaruf.ts` | ✅ Done | Fetch, actions, state management |
| Profile Form | `components/TaarufProfileForm.tsx` | ✅ Done | Wizard 3 tab: profil, kriteria, surat |
| Swipe Deck | `components/SwipeDeck.tsx` | ✅ Done | Wrapper swipe, mode browse & review |
| Swipe Card | `components/SwipeCard.tsx` | ✅ Done | Kartu profil, gesture drag kiri/kanan |
| Confirm Sheet | `components/ConfirmSheet.tsx` | ✅ Done | Bottom sheet konfirmasi + validasi pesan |
| Waiting Screen | `components/WaitingScreen.tsx` | ✅ Done | State pria menunggu jawaban |
| Empty Inbox | `components/EmptyInbox.tsx` | ✅ Done | State wanita belum ada lamaran masuk |
| Matched Chat | `components/MatchedChatRoom.tsx` | ✅ Done | Chat room post-match |
| Interest Picker | `components/InterestPicker.tsx` | ✅ Done | Multi-select chips minat |
| Location Picker | `components/LocationPicker.tsx` | ✅ Done | Input lokasi |
| Dropdown Select | `components/DropdownSelect.tsx` | ✅ Done | Custom dropdown reusable |

---

## 6. Yang Belum Diimplementasi / Gap

| # | Gap | Catatan |
|---|-----|---------|
| 1 | Notifikasi ke penerima lamaran | Ada `// TODO` di `POST /api/taaruf/applications` |
| 2 | Polling / real-time update status lamaran | WaitingScreen tidak auto-refresh |
| 3 | Field `letters` (surat lamaran formal) | Ada di schema JSONB tapi belum dipakai di form/API |
| 4 | Upload foto profil | `photo_url` dan `cover_photo` diterima API tapi UI belum ada input file upload |
| 5 | Halaman profil detail sebelum lamar | Saat ini tap card langsung ke ConfirmSheet tanpa halaman profil penuh |
| 6 | Filter profil berdasarkan kriteria | Available profiles di-query `ORDER BY RANDOM()`, kriteria user belum di-match |
| 7 | Withdraw lamaran oleh pria | Status `withdrawn` ada di schema tapi belum ada endpoint/UI |
| 8 | System message insert error | Insert ke `messages` pakai kolom `is_system` dan `content` yang mungkin tidak ada di schema lokal |

---

## 7. Catatan Penting

- **Seluruh alur accept dalam satu DB transaction** — jika salah satu langkah gagal, semua di-rollback
- **Nuclear family baru otomatis dibuat** saat match — tidak perlu setup manual
- **Chat room ta'aruf** scope-nya `small` dan dimasukkan ke `chat_rooms` standar, sehingga langsung muncul di halaman Messages
- `room_memberships` adalah tabel baru (migration 015) — berbeda dari `nuclear_family_memberships`
- Gender ditentukan dari tabel `nodes.gender`, bukan dari profil ta'aruf
- Profile ta'aruf dianggap "lengkap" jika `location`, `education_level`, `occupation`, dan `interests` semua terisi
