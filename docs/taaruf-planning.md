# Fitur Ta'aruf — CeritaKeluarga
### Planning & AI Prompt Document

> **Stack:** Next.js (App Router) · React · TypeScript · Tailwind CSS  
> **Scope dokumen ini:** Frontend only — UI components, state, routing, gesture  
> **Tema:** CeritaKeluarga warm organic (`#FDFAF5` / `#4A7C59` / `#EDE4D3`)

---

## 1. Ringkasan Fitur

Fitur ta'aruf adalah modul pencarian jodoh Islami yang terintegrasi dengan family tree yang sudah ada. Fitur ini hanya bisa diakses oleh user yang **belum memiliki koneksi spouse** di family tree mereka.

**Alur utama:**

```
Masuk /taaruf
    │
    ├─ has_spouse? → redirect ke /tree
    │
    ├─ profile belum ada → Form wizard (3 tab)
    │
    └─ profile sudah ada
         ├─ Gender PRIA
         │    ├─ Tidak ada lamaran aktif → Swipe deck wanita
         │    │    └─ Swipe kanan → Bottom sheet konfirmasi + pesan (min 20 char)
         │    │         └─ Kirim → Status "Menunggu" (tidak bisa swipe lagi)
         │    │              ├─ Lamaran diterima → Chat room keluarga
         │    │              └─ Lamaran ditolak → Kembali ke swipe deck
         │    └─ Ada lamaran aktif pending → Halaman tunggu
         │
         └─ Gender WANITA
              ├─ Tidak ada lamaran masuk → Empty state
              └─ Ada lamaran masuk → Review swipe deck
                   └─ Swipe kiri/kanan → Bottom sheet konfirmasi + pesan (min 20 char)
                        ├─ Terima → Chat room keluarga
                        └─ Tolak → Lamaran berikutnya / empty state
```

---

## 2. File Structure

```
src/app/taaruf/
├── page.tsx                        ← Gate: cek spouse + routing gender
├── loading.tsx                     ← Skeleton loading
└── components/
    ├── TaarufProfileForm.tsx       ← Wizard form 3 tab
    ├── SwipeCard.tsx               ← Kartu profil (mode: browse | review)
    ├── SwipeDeck.tsx               ← Wrapper swipe + gesture
    ├── ConfirmSheet.tsx            ← Bottom sheet konfirmasi (pria & wanita)
    ├── WaitingScreen.tsx           ← State menunggu jawaban (pria)
    ├── EmptyInbox.tsx              ← State belum ada lamaran (wanita)
    └── MatchedChatRoom.tsx         ← Chat room post-match (wrap komponen chat)

src/app/taaruf/hooks/
└── useTaaruf.ts                    ← Hook utama: fetch, actions, state

src/app/api/taaruf/
├── route.ts                        ← GET (status) · POST (create/update profile)
└── applications/
    ├── route.ts                    ← GET (list) · POST (kirim lamaran)
    └── [id]/
        └── route.ts               ← PUT (accept | reject + pesan balasan)

src/app/api/chat/
└── create-taaruf-room/
    └── route.ts                   ← Buat chat room + auto-invite keluarga
```

---

## 3. State Map

| Kondisi | Screen yang tampil |
|---|---|
| `has_spouse = true` | Redirect `/tree` |
| `profile = null` | `TaarufProfileForm` (wizard) |
| Pria, `outgoing = null` | `SwipeDeck` mode browse |
| Pria, `outgoing.status = pending` | `WaitingScreen` |
| Pria, `outgoing.status = accepted` | `MatchedChatRoom` |
| Pria, `outgoing.status = rejected` | `SwipeDeck` mode browse (reset) |
| Wanita, `incoming = []` | `EmptyInbox` |
| Wanita, `incoming.length > 0` | `SwipeDeck` mode review |
| Wanita, matched | `MatchedChatRoom` |

---

## 4. Komponen Detail

### 4.1 `page.tsx` — Gate

```tsx
// Logic:
// 1. Fetch GET /api/taaruf
// 2. Jika has_spouse → redirect('/tree')
// 3. Jika profile null → render <TaarufProfileForm />
// 4. Jika profile ada → cek gender → render screen sesuai state map
```

**Props/data yang dibutuhkan dari API:**

```ts
interface TaarufStatus {
  has_spouse: boolean
  my_profile: TaarufProfile | null
  gender: 'male' | 'female'
  outgoing_application: Application | null   // untuk pria
  incoming_applications: Application[]        // untuk wanita
  matched_room: ChatRoom | null
}
```

---

### 4.2 `TaarufProfileForm.tsx` — Wizard 3 Tab

**Tab 1 — Profil Pribadi:**
- Foto profil (upload, max 2MB)
- Nama (auto-fill dari user node, readonly)
- Usia (auto dari birth_date, readonly)
- Lokasi tempat tinggal
- Pendidikan terakhir
- Pekerjaan
- Tentang saya (textarea)
- Minat/hobi (multi-select chips)

**Tab 2 — Kriteria Pasangan:**
- Usia min–max (range input)
- Lokasi yang diinginkan (radius km)
- Pendidikan (checkbox multiple)
- Status perkawinan calon
- Kriteria tambahan (textarea)

**Tab 3 — Surat Lamaran:**
- Perkenalan diri (min 200 karakter)
- Visi keluarga (textarea)
- Komitmen menjaga keluarga (textarea)

**Behavior:**
- Progress tersimpan sebagai `draft` per tab — user bisa keluar dan lanjut
- Tombol "Simpan & Lanjut" per tab
- Tab 3 selesai → `POST /api/taaruf` dengan `status: 'active'`
- Validasi real-time per field sebelum lanjut tab

---

### 4.3 `SwipeCard.tsx` — Kartu Profil

```tsx
interface SwipeCardProps {
  profile: TaarufProfile
  application?: Application    // hanya di mode review (ada pesan lamaran pria)
  mode: 'browse' | 'review'
  onAccept: () => void         // buka ConfirmSheet
  onReject: () => void         // buka ConfirmSheet (mode review) atau skip (browse)
}
```

**Visual:**
- Full-height card dengan background gelap bertema alam (dark green untuk wanita, dark navy untuk pria)
- Avatar placeholder dengan ikon user
- Overlay gradient bawah → nama, meta (pekerjaan · kota), about, chips hobi
- Jika `mode = 'review'`: tampilkan kotak pesan lamaran di overlay
- Aksi: tombol ✕ (Lewati/Tolak) dan ✓ (Lamar/Terima) di bawah card
- Dots pagination untuk menunjukkan jumlah antrian

**Gesture (gunakan `@use-gesture/react`):**
- Drag kanan ≥ 80px → trigger `onAccept`
- Drag kiri ≥ 80px → trigger `onReject`
- Visual feedback: card miring sesuai arah drag, overlay warna merah/hijau

---

### 4.4 `ConfirmSheet.tsx` — Bottom Sheet Konfirmasi

Dipakai oleh **pria** (kirim lamaran) dan **wanita** (terima/tolak).

```tsx
interface ConfirmSheetProps {
  isOpen: boolean
  variant: 'send' | 'accept' | 'reject'
  targetProfile: TaarufProfile
  onConfirm: (message: string) => void
  onCancel: () => void
  isLoading: boolean
}
```

**Rules validasi pesan:**
- Minimum 20 karakter
- Tombol aksi disabled + opacity 0.4 sampai syarat terpenuhi
- Counter karakter real-time: `"X / min. 20 karakter"` → hijau jika sudah cukup

**Variant `send` (pria):**
- Judul: "Kirim lamaran ta'aruf"
- Satu tombol: "Kirim Lamaran" (hijau)
- Info: "Lamaran hanya bisa dikirim satu kali"

**Variant `accept` (wanita):**
- Judul: "Terima lamaran ini?"
- Dua tombol: "Tolak" (merah muda) dan "Terima" (hijau)
- Keduanya disabled sampai pesan ≥ 20 karakter

**Variant `reject` (wanita):**
- Sama dengan `accept` — pakai 1 sheet yang sama, user memilih tombol mana yang ditekan

---

### 4.5 `WaitingScreen.tsx` — Pria Menunggu

Tampil ketika `outgoing_application.status = 'pending'`.

**Konten:**
- Ikon jam dengan latar gold (`#F5E8C8`)
- Judul: "Lamaran sedang ditinjau"
- Status card: nama penerima, tanggal kirim, badge status
- Preview pesan yang dikirim (truncated)
- Tombol "Edit Profil Saya" (secondary)

**Behavior:**
- Polling setiap 30 detik atau SSE untuk update status
- Jika status berubah ke `accepted` → redirect ke chat room
- Jika status berubah ke `rejected` → tampil toast, kembali ke swipe deck

---

### 4.6 `MatchedChatRoom.tsx` — Chat Keluarga

Wrap komponen chat yang sudah ada dengan kustomisasi:

- Header: avatar grup + "Ta'aruf: {namaPria} & {namaWanita}" + jumlah anggota
- System bubble pertama: pesan selamat otomatis dari sistem
- Bubble warna: pesan sendiri → `#4A7C59` (ck-green), pesan orang lain → `#FDFAF5`
- Input bar: background `#EDE4D3`, tombol kirim `#4A7C59`

**Auto-invite anggota (dilakukan di BE saat accept):**
1. Cari semua relasi nuclear family pria (ayah, ibu, saudara kandung)
2. Cari semua relasi nuclear family wanita
3. Invite semua ke chat room baru dengan nama "Ta'aruf: X & Y"

---

### 4.7 `useTaaruf.ts` — Hook Utama

```ts
function useTaaruf() {
  return {
    // State
    status: TaarufStatus | null,
    isLoading: boolean,

    // Pria actions
    sendApplication: (recipientId: number, message: string) => Promise<void>,
    skipProfile: () => void,

    // Wanita actions
    acceptApplication: (applicationId: number, message: string) => Promise<void>,
    rejectApplication: (applicationId: number, message: string) => Promise<void>,

    // Shared
    updateProfile: (data: ProfileFormData) => Promise<void>,
    refreshStatus: () => Promise<void>,
  }
}
```

---

## 5. Aturan Bisnis (Business Rules)

| # | Rule |
|---|---|
| 1 | User dengan spouse aktif **tidak bisa akses** fitur ta'aruf sama sekali |
| 2 | Pria hanya bisa memiliki **1 lamaran aktif** (pending/accepted) pada satu waktu |
| 3 | Jika lamaran pria **ditolak**, ia kembali ke mode available dan bisa lamar wanita lain |
| 4 | Pria **tidak bisa melamar** wanita yang sama dua kali |
| 5 | Setiap konfirmasi (kirim/terima/tolak) **wajib disertai pesan** minimal 20 karakter |
| 6 | Wanita menerima lamaran **satu per satu** (FIFO berdasarkan created_at) |
| 7 | Setelah match, halaman ta'aruf **hanya menampilkan chat room** — tidak ada swipe |
| 8 | Profil ta'aruf berstatus `draft` tidak muncul di daftar swipe pria |

---

## 6. Warna & Tema

Semua komponen ta'aruf mengikuti token CeritaKeluarga:

```
Latar halaman        #F5F0E8   (ck-page)
Kartu / panel        #FDFAF5   (ck-card)
Surface / input bg   #EDE4D3   (ck-surface)
Border               #D4C4A8   (ck-border)
Teks utama           #3B2F1E   (ck-text1)
Teks sekunder        #6B5B45   (ck-text2)
Teks hint            #9C8B75   (ck-text3)
Aksi utama (hijau)   #4A7C59   (ck-green)
Hijau muda           #D6EAD9   (ck-green-lt)
Hijau gelap          #2E5239   (ck-green-dk)
Aksen emas           #C4922A   (ck-gold)
Emas muda            #F5E8C8   (ck-gold-lt)
```

---

## 7. Urutan Implementasi

```
Sprint 1 — Gate & Form
  [ ] page.tsx — gate logic (cek spouse, routing gender)
  [ ] TaarufProfileForm.tsx — wizard 3 tab + validasi
  [ ] POST /api/taaruf — simpan profile + kriteria + surat
  [ ] GET /api/taaruf — return TaarufStatus

Sprint 2 — Swipe Pria
  [ ] SwipeCard.tsx — mode browse
  [ ] SwipeDeck.tsx — wrapper + gesture (@use-gesture/react)
  [ ] ConfirmSheet.tsx — variant 'send' + validasi pesan
  [ ] POST /api/taaruf/applications — kirim lamaran
  [ ] WaitingScreen.tsx — state menunggu

Sprint 3 — Review Wanita
  [ ] SwipeCard.tsx — mode review (tampil pesan lamaran)
  [ ] ConfirmSheet.tsx — variant 'accept'/'reject'
  [ ] PUT /api/taaruf/applications/[id] — terima/tolak + pesan
  [ ] EmptyInbox.tsx — state belum ada lamaran

Sprint 4 — Match & Chat
  [ ] POST /api/chat/create-taaruf-room — buat room + invite keluarga
  [ ] MatchedChatRoom.tsx — wrap chat + sistem bubble
  [ ] Polling / SSE untuk update status real-time
  [ ] Push notification (browser notification API)
```

---

## 8. Library yang Dibutuhkan

```bash
npm install @use-gesture/react   # gesture swipe
npm install framer-motion        # animasi swipe card (opsional, jika belum ada)
```

---

---

# AI PROMPTS

Gunakan prompt-prompt di bawah ini satu per satu ke Claude atau Cursor/GitHub Copilot. Setiap prompt bersifat mandiri dan menghasilkan satu file atau satu bagian kode yang utuh.

---

## Prompt 1 — `page.tsx` (Gate & Router)

```
Kamu adalah developer Next.js (App Router, TypeScript).

Buat file `src/app/taaruf/page.tsx` untuk fitur ta'aruf pada aplikasi keluarga Muslim "CeritaKeluarga".

KONTEKS:
- Aplikasi sudah memiliki family tree dengan koneksi spouse dan anak
- User yang sudah punya spouse TIDAK boleh akses fitur ini
- Setelah cek gate, routing tergantung gender dan state lamaran

YANG HARUS DILAKUKAN:
1. Fetch GET /api/taaruf saat komponen mount (gunakan useEffect + fetch, atau SWR jika sudah ada)
2. Response memiliki shape:
   {
     has_spouse: boolean,
     my_profile: TaarufProfile | null,
     gender: 'male' | 'female',
     outgoing_application: Application | null,
     incoming_applications: Application[],
     matched_room: { id: number, name: string } | null
   }
3. Jika has_spouse = true → redirect ke /tree menggunakan next/navigation router.push
4. Jika my_profile = null → render <TaarufProfileForm />
5. Jika gender = 'male':
   - matched_room ada → render <MatchedChatRoom room={matched_room} />
   - outgoing_application?.status = 'pending' → render <WaitingScreen application={outgoing_application} />
   - selain itu → render <SwipeDeck mode="browse" />
6. Jika gender = 'female':
   - matched_room ada → render <MatchedChatRoom room={matched_room} />
   - incoming_applications.length > 0 → render <SwipeDeck mode="review" applications={incoming_applications} />
   - selain itu → render <EmptyInbox />
7. Tampilkan loading skeleton selama fetch berlangsung

STYLING:
- Gunakan Tailwind CSS
- Warna latar halaman: bg-[#F5F0E8]
- Semua komponen child sudah dibuat terpisah, cukup import dan render

ATURAN:
- Gunakan TypeScript dengan interface yang jelas
- Tidak perlu buat implementasi komponen child — cukup import dengan path yang benar
- Tambahkan komentar singkat di setiap bagian logic
```

---

## Prompt 2 — `SwipeCard.tsx`

```
Kamu adalah developer React + TypeScript.

Buat komponen `src/app/taaruf/components/SwipeCard.tsx` untuk fitur ta'aruf CeritaKeluarga.

KONTEKS DESAIN (tema warm organic):
- Background card: gradient gelap (dark green untuk profil wanita, dark navy untuk profil pria)
- Overlay gradient dari bawah (hitam transparan ke transparan) untuk readability teks
- Nama, meta info, deskripsi singkat, chips hobi tampil di overlay bawah
- Di mode "review" (wanita melihat lamaran), tampilkan kotak pesan lamaran dari pria di dalam overlay

PROPS:
interface SwipeCardProps {
  profile: {
    full_name: string
    age: number
    occupation: string
    location: string
    about_me: string
    interests: string[]
    photo_url?: string
  }
  application?: {
    id: number
    message: string  // pesan dari pria, hanya ada di mode review
  }
  mode: 'browse' | 'review'
  onAccept: () => void
  onReject: () => void
}

TAMPILAN:
1. Area foto/background: tinggi 360px, relative positioning
2. Avatar placeholder (ikon user) di tengah atas jika tidak ada photo_url
3. Overlay gradient bawah dengan: nama besar, meta kecil (pekerjaan · kota), about (2 baris), chips hobi
4. Jika mode='review' dan application.message ada: kotak pesan dengan background rgba putih transparan, label "Pesan lamaran", isi pesan (max 3 baris)
5. Action bar di bawah card (background #FDFAF5, border atas #D4C4A8):
   - Tombol ✕ lingkaran border merah (#A03030), klik → onReject
   - Hint teks "geser atau tap" di tengah
   - Tombol ✓ lingkaran border hijau (#4A7C59), klik → onAccept
   - Label "Lewati"/"Tolak" dan "Lamar"/"Terima" di bawah masing-masing tombol sesuai mode

ATURAN:
- Gunakan Tailwind CSS dengan arbitrary values sesuai token warna CeritaKeluarga
- Gunakan Tabler Icons (react-icons/tb atau @tabler/icons-react) untuk ikon user, briefcase, map-pin
- Tidak perlu implementasi gesture swipe di sini (dihandle SwipeDeck)
- Komponen murni presentational — tidak ada fetch atau state internal selain hover
- Tambahkan aria-label pada tombol aksi
```

---

## Prompt 3 — `ConfirmSheet.tsx`

```
Kamu adalah developer React + TypeScript.

Buat komponen `src/app/taaruf/components/ConfirmSheet.tsx`.

Komponen ini adalah bottom sheet konfirmasi yang dipakai di dua situasi:
1. Pria mengkonfirmasi kirim lamaran (variant='send')
2. Wanita mengkonfirmasi terima atau tolak lamaran (variant='accept-reject')

PROPS:
interface ConfirmSheetProps {
  isOpen: boolean
  variant: 'send' | 'accept-reject'
  targetProfile: {
    full_name: string
    age: number
    occupation: string
    location: string
  }
  onSend?: (message: string) => void           // variant send
  onAccept?: (message: string) => void         // variant accept-reject
  onReject?: (message: string) => void         // variant accept-reject
  onCancel: () => void
  isLoading?: boolean
}

TAMPILAN:
- Overlay gelap semi-transparan di belakang (rgba(30,20,12,0.48))
- Sheet putih (bg #FDFAF5, border-radius 20px di atas) muncul dari bawah
- Drag handle pill di atas sheet
- Avatar inisial target profile
- Nama + peran target

TEXTAREA PESAN:
- Background #EDE4D3, border #D4C4A8, border-radius 10px
- Placeholder sesuai variant
- VALIDASI: minimum 20 karakter
- Counter real-time: "X / min. 20 karakter"
  - Warna abu (#9C8B75) jika belum cukup
  - Warna hijau (#4A7C59) jika sudah cukup

TOMBOL:
Variant 'send':
  - "Batal" (secondary, bg #EDE4D3)
  - "Kirim Lamaran →" (primary, bg #4A7C59, teks putih)
  - Tombol kirim: disabled + opacity-40 jika pesan < 20 karakter

Variant 'accept-reject':
  - "Batal" (secondary)
  - "Tolak" (merah muda: bg #F5E0E0, teks #A03030, border #A03030)
  - "Terima" (hijau: bg #4A7C59, teks putih)
  - Kedua tombol: disabled + opacity-40 jika pesan < 20 karakter
  - Jika isLoading: tampilkan spinner di tombol yang diklik

CATATAN di bawah tombol:
  Variant send: "Lamaran hanya bisa dikirim satu kali. Pastikan pesanmu tulus dan sopan."
  Variant accept-reject: "Isi pesan min. 20 karakter untuk mengaktifkan tombol di atas."

ANIMASI:
  - Sheet slide up saat isOpen true (gunakan CSS transition atau framer-motion)
  - Sheet slide down saat isOpen false

ATURAN:
  - Gunakan useState untuk nilai textarea dan loading per tombol
  - Tidak ada fetch di dalam komponen ini — semua aksi via props callback
  - Tombol disabled tidak bisa diklik (gunakan atribut disabled atau pointer-events-none)
```

---

## Prompt 4 — `WaitingScreen.tsx`

```
Kamu adalah developer React + TypeScript.

Buat komponen `src/app/taaruf/components/WaitingScreen.tsx`.

Komponen ini tampil ketika pria sudah mengirim lamaran dan sedang menunggu respons wanita.

PROPS:
interface WaitingScreenProps {
  application: {
    id: number
    recipient_name: string
    message: string
    created_at: string         // ISO date string
    status: 'pending'
  }
  onEditProfile: () => void
}

LAYOUT (gunakan bg-[#F5F0E8] sebagai background halaman):

1. Hero section (bg #FDFAF5, border bawah #D4C4A8):
   - Ikon jam dalam lingkaran (bg #F5E8C8, border #D4C4A8, ukuran 72px)
   - Judul: "Lamaran sedang ditinjau" (font-medium, #3B2F1E)
   - Subjudul: "Bersabarlah. {recipient_name} akan merespons lamaranmu setelah bermusyawarah dengan keluarganya." (#6B5B45)

2. Status card (bg #F5E8C8, border #D4C4A8, margin 12px, rounded-xl, padding 12px):
   - Label: "STATUS LAMARAN" (uppercase, font kecil, warna #C4922A)
   - Row: "Dikirim kepada" | nama penerima (bold)
   - Row: "Tanggal kirim" | format tanggal Indonesia (mis: 5 Juni 2026)
   - Row: "Status" | badge pill "Menunggu" (bg #F5E8C8, teks #C4922A, border #C4922A)

3. Info block (bg #EDE4D3, border #D4C4A8, margin 0 12px 12px):
   - Label tebal: "Pesan yang kamu kirim:"
   - Isi pesan (truncated 3 baris, warna #6B5B45)

4. Tombol "Edit Profil Saya" (full width, secondary style, bg #EDE4D3, teks #6B5B45)

ATURAN:
  - Format tanggal menggunakan Intl.DateTimeFormat('id-ID', { day:'numeric', month:'long', year:'numeric' })
  - Tidak ada fetch di komponen ini — data dari props
  - Gunakan Tabler Icons untuk ikon jam (IconClock)
```

---

## Prompt 5 — `useTaaruf.ts` (Hook)

```
Kamu adalah developer React + TypeScript.

Buat custom hook `src/app/taaruf/hooks/useTaaruf.ts` untuk fitur ta'aruf CeritaKeluarga.

Hook ini adalah satu-satunya tempat semua API call terjadi untuk fitur ini.

TYPES:
interface TaarufProfile {
  id: number
  full_name: string
  age: number
  occupation: string
  location: string
  about_me: string
  interests: string[]
  photo_url?: string
  status: 'draft' | 'active' | 'matched' | 'closed'
}

interface Application {
  id: number
  sender_profile_id: number
  recipient_profile_id: number
  message: string
  status: 'pending' | 'accepted' | 'rejected' | 'withdrawn'
  created_at: string
  chat_room_id?: number
  recipient_name?: string
  sender_name?: string
  sender_occupation?: string
  sender_location?: string
  sender_interests?: string[]
  sender_about?: string
}

interface TaarufStatus {
  has_spouse: boolean
  my_profile: TaarufProfile | null
  gender: 'male' | 'female'
  outgoing_application: Application | null
  incoming_applications: Application[]
  matched_room: { id: number; name: string } | null
  available_profiles: TaarufProfile[]  // untuk pria: list wanita yang bisa di-swipe
}

YANG HARUS DIEKSPOS:
{
  // Data
  status: TaarufStatus | null,
  isLoading: boolean,
  error: string | null,

  // Actions — semua return Promise<void> dan update state lokal setelah berhasil
  updateProfile: (data: Partial<TaarufProfile & { criteria: any; letter: any }>) => Promise<void>,
  sendApplication: (recipientProfileId: number, message: string) => Promise<void>,
  skipProfile: (profileId: number) => void,    // sinkron, cukup update lokal index
  acceptApplication: (applicationId: number, message: string) => Promise<void>,
  rejectApplication: (applicationId: number, message: string) => Promise<void>,
  refreshStatus: () => Promise<void>,
}

BEHAVIOR:
- Fetch GET /api/taaruf saat mount
- sendApplication: POST /api/taaruf/applications dengan { recipient_profile_id, message }
  → Setelah berhasil, update outgoing_application di state lokal
- acceptApplication: PUT /api/taaruf/applications/{id} dengan { action: 'accept', message }
  → Setelah berhasil, set matched_room dari response
- rejectApplication: PUT /api/taaruf/applications/{id} dengan { action: 'reject', message }
  → Setelah berhasil, update incoming_applications (hapus yang ditolak)
- skipProfile: hanya geser index di available_profiles, tidak ada API call
- updateProfile: POST /api/taaruf dengan data form
- refreshStatus: re-fetch GET /api/taaruf (untuk polling)

ERROR HANDLING:
- Setiap action set isLoading = true sebelum fetch, false setelah selesai
- Jika response tidak ok, set error = pesan dari response body
- Gunakan try/catch

ATURAN:
- Gunakan useCallback untuk semua functions
- Gunakan useReducer jika state kompleks, atau useState per field
- Ekspor tipe TaarufStatus untuk dipakai di page.tsx
```

---

## Prompt 6 — `MatchedChatRoom.tsx`

```
Kamu adalah developer React + TypeScript.

Buat komponen `src/app/taaruf/components/MatchedChatRoom.tsx`.

Komponen ini membungkus chat room yang sudah ada di aplikasi CeritaKeluarga dan menambahkan kustomisasi untuk konteks ta'aruf.

PROPS:
interface MatchedChatRoomProps {
  room: {
    id: number
    name: string
    member_count: number
  }
}

ASUMSI:
- Sudah ada komponen <ChatRoom roomId={number} /> yang bisa di-import dari komponen chat yang ada
- Atau sudah ada hook useChatRoom(roomId) yang mengembalikan messages dan sendMessage

YANG PERLU DITAMBAHKAN DI ATAS ChatRoom:

1. Header kustom (bg #FDFAF5, border bawah #D4C4A8):
   - Avatar grup lingkaran (bg #D6EAD9, ikon users #4A7C59, ukuran 32px)
   - Nama room (contoh: "Ta'aruf: Ahmad & Siti")
   - Teks member: "{member_count} anggota · keluarga inti kedua pihak"

2. System bubble (tampil sebagai pesan pertama di atas semua pesan lain):
   - Background: #F5E8C8
   - Border: #D4C4A8
   - Teks emas: #C4922A
   - Isi: "Alhamdulillah — {nama pria} dan {nama wanita} telah terhubung. Semoga Allah meridhoi proses ta'aruf ini."
   - Tampilkan sebagai pesan sistem, bukan pesan chat biasa

3. Styling bubble (jika ChatRoom bisa di-customize via props):
   - Bubble sendiri: bg #4A7C59, teks putih
   - Bubble orang lain: bg #FDFAF5, border #D4C4A8, teks #3B2F1E

4. Input bar:
   - Background input: #EDE4D3
   - Tombol kirim: bg #4A7C59

JIKA tidak bisa mengkustomisasi ChatRoom yang ada, buat implementasi chat sederhana sendiri:
- Gunakan useState untuk messages
- Fetch messages dari GET /api/chat/rooms/{roomId}/messages
- POST /api/chat/rooms/{roomId}/messages untuk kirim
- Polling setiap 5 detik untuk pesan baru

ATURAN:
- Gunakan Tabler Icons (IconUsers, IconSend)
- Tailwind CSS dengan token warna CeritaKeluarga
- Pastikan nama pria dan wanita bisa di-parse dari room.name (format "Ta'aruf: X & Y")
```

---

## Prompt 7 — Styling Global (tambahan `globals.css`)

```
Tambahkan CSS variables berikut ke dalam blok :root di file globals.css.
Jangan ubah apapun yang sudah ada, cukup tambahkan variabel baru ini.
Variabel ini akan membuat semua komponen shadcn/ui (Card, Input, Button, dll)
otomatis menggunakan tema warm organic CeritaKeluarga.

/* === CeritaKeluarga Warm Organic Theme === */
:root {
  --background:          30 43% 97%;
  --foreground:          27 32% 17%;
  --card:                30 43% 97%;
  --card-foreground:     27 32% 17%;
  --popover:             30 43% 97%;
  --popover-foreground:  27 32% 17%;
  --primary:             143 25% 39%;
  --primary-foreground:  0 0% 100%;
  --secondary:           34 35% 88%;
  --secondary-foreground: 27 21% 29%;
  --muted:               34 35% 88%;
  --muted-foreground:    27 14% 53%;
  --accent:              143 25% 39%;
  --accent-foreground:   0 0% 100%;
  --destructive:         0 50% 40%;
  --destructive-foreground: 0 0% 100%;
  --border:              34 28% 75%;
  --input:               34 28% 75%;
  --ring:                143 25% 39%;
  --radius:              0.625rem;
}

Setelah menambahkan, verifikasi bahwa tidak ada konflik dengan variabel :root yang sudah ada sebelumnya.
Jika ada variabel yang sama, GANTI nilainya dengan nilai di atas — jangan duplikasi.
```

---

*Dokumen ini dibuat untuk proyek CeritaKeluarga. Gunakan setiap prompt secara berurutan sesuai sprint yang sudah direncanakan.*
