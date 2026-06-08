# AI Prompts — Perbaikan `TaarufProfileForm.tsx`
### Bertahap · 3 Prompt

> **Konteks:** Form profil ta'aruf di aplikasi CeritaKeluarga.
> Masalah saat ini: tampilan kurang modern, input lokasi bebas ketik (rawan typo),
> pilihan minat terlalu sedikit dan statis.
> Tema warna sudah benar — jangan ubah token warna.

---

## Sebelum mulai — baca kode yang ada

Kode awal yang akan diperbaiki ada di:
`src/app/taaruf/components/TaarufProfileForm.tsx`

Lihat juga `src/app/taaruf/page.tsx` untuk konteks bagaimana form ini dipanggil.

---

## PROMPT 1 — Struktur & navigasi form yang lebih modern

**Tujuan prompt ini:**
Ubah tab pill biasa menjadi stepper yang lebih jelas progress-nya,
perbaiki layout kartu form, dan tambahkan indikator kelengkapan per step.
Belum menyentuh input lokasi atau minat — itu di prompt 2 dan 3.

```
Kamu adalah developer React + TypeScript.

Refactor BAGIAN STRUKTUR dari komponen TaarufProfileForm.tsx berikut.
Jangan ubah logika state, handler, atau isi field — hanya ubah struktur visual wrapper dan navigasinya.

KODE AWAL (yang perlu direfactor):
[paste seluruh isi TaarufProfileForm.tsx di sini]

PERUBAHAN YANG DIINGINKAN:

1. GANTI tab pill menjadi stepper horizontal
   Layout stepper:
   [① Profil Pribadi] ——— [② Kriteria] ——— [③ Surat Lamaran]

   Per step: nomor dalam lingkaran + label di bawahnya
   - Step sudah selesai (index < activeTab):
     lingkaran bg #4A7C59, centang putih (Tabler: IconCheck)
   - Step aktif (index === activeTab):
     lingkaran bg #4A7C59, nomor putih, label bold #3B2F1E
   - Step belum (index > activeTab):
     lingkaran border #D4C4A8 bg #FDFAF5, nomor #9C8B75, label #9C8B75
   Garis penghubung antar lingkaran:
     - Sudah lewat: bg #4A7C59
     - Belum: bg #D4C4A8
   Lebar lingkaran: 32px, font nomor: 13px

2. GANTI CardHeader menjadi label inline di dalam CardContent
   Tidak perlu CardHeader terpisah. Letakkan judul step sebagai
   teks h2 font-medium text-[#3B2F1E] di dalam padding form,
   dengan garis bawah tipis border-b border-[#D4C4A8] pb-3 mb-4.

3. PERBAIKI tombol navigasi bawah
   Layout: [← Sebelumnya] [Selanjutnya →] atau [Simpan & Aktifkan]
   Tombol Sebelumnya: ghost, border #D4C4A8, teks #6B5B45, hanya tampil jika activeTab > 0
   Tombol Selanjutnya/Simpan: bg #4A7C59, teks putih, hover bg #2E5239
   Jika isLoading: tampilkan Tabler IconLoader2 berputar di dalam tombol

4. TAMBAHKAN progress bar tipis di bawah stepper
   Tinggi 3px, full width, bg #EDE4D3
   Fill: bg #4A7C59, width = ((activeTab + 1) / tabs.length * 100)%
   Transition: width 300ms ease

5. TAMBAHKAN label "Langkah X dari 3" di bawah progress bar
   Font 11px, teks #9C8B75, text-right

ATURAN:
- Gunakan Tailwind CSS arbitrary values sesuai token CeritaKeluarga
- Gunakan Tabler Icons (@tabler/icons-react) — JANGAN gunakan emoji
- Pertahankan semua state, handler, dan logika yang sudah ada
- Pertahankan semua field input yang sudah ada persis sama
- Hanya ubah wrapper, stepper, dan tombol navigasi
- Output: file TaarufProfileForm.tsx lengkap yang siap dipakai
```

---

## PROMPT 2 — Input lokasi terstruktur (Provinsi → Kota/Kabupaten)

**Tujuan prompt ini:**
Ganti input teks bebas untuk lokasi menjadi dua dropdown bertingkat:
pilih Provinsi dulu, lalu pilih Kota/Kabupaten sesuai provinsi yang dipilih.
Data statis (tidak perlu API eksternal).

```
Kamu adalah developer React + TypeScript.

Buat komponen baru `src/app/taaruf/components/LocationPicker.tsx`
dan modifikasi field Lokasi di TaarufProfileForm.tsx untuk menggunakannya.

=== KOMPONEN LocationPicker.tsx ===

PROPS:
interface LocationPickerProps {
  value: { province: string; city: string }
  onChange: (val: { province: string; city: string }) => void
  label?: string
  required?: boolean
}

DATA LOKASI (gunakan data statis ini — representasi provinsi Indonesia):
Buat objek INDONESIA_REGIONS dengan struktur:
{
  "Aceh": ["Banda Aceh", "Langsa", "Lhokseumawe", "Sabang", "Subulussalam"],
  "Sumatera Utara": ["Medan", "Binjai", "Gunungsitoli", "Padangsidimpuan", "Pematangsiantar", "Sibolga", "Tanjungbalai", "Tebing Tinggi"],
  "Sumatera Barat": ["Padang", "Bukittinggi", "Padang Panjang", "Pariaman", "Payakumbuh", "Sawahlunto", "Solok"],
  "Riau": ["Pekanbaru", "Dumai"],
  "Kepulauan Riau": ["Tanjungpinang", "Batam"],
  "Jambi": ["Jambi", "Sungai Penuh"],
  "Sumatera Selatan": ["Palembang", "Lubuklinggau", "Pagaralam", "Prabumulih"],
  "Kepulauan Bangka Belitung": ["Pangkalpinang"],
  "Bengkulu": ["Bengkulu"],
  "Lampung": ["Bandar Lampung", "Metro"],
  "DKI Jakarta": ["Jakarta Pusat", "Jakarta Utara", "Jakarta Barat", "Jakarta Selatan", "Jakarta Timur"],
  "Jawa Barat": ["Bandung", "Bekasi", "Bogor", "Cimahi", "Cirebon", "Depok", "Sukabumi", "Tasikmalaya"],
  "Banten": ["Cilegon", "Serang", "Tangerang", "Tangerang Selatan"],
  "Jawa Tengah": ["Semarang", "Magelang", "Pekalongan", "Purwokerto", "Salatiga", "Solo", "Tegal"],
  "DI Yogyakarta": ["Yogyakarta", "Sleman", "Bantul", "Gunungkidul", "Kulon Progo"],
  "Jawa Timur": ["Surabaya", "Batu", "Blitar", "Kediri", "Madiun", "Malang", "Mojokerto", "Pasuruan", "Probolinggo"],
  "Bali": ["Denpasar"],
  "Nusa Tenggara Barat": ["Mataram", "Bima"],
  "Nusa Tenggara Timur": ["Kupang"],
  "Kalimantan Barat": ["Pontianak", "Singkawang"],
  "Kalimantan Tengah": ["Palangka Raya"],
  "Kalimantan Selatan": ["Banjarbaru", "Banjarmasin"],
  "Kalimantan Timur": ["Balikpapan", "Bontang", "Samarinda"],
  "Kalimantan Utara": ["Tarakan"],
  "Sulawesi Utara": ["Bitung", "Kotamobagu", "Manado", "Tomohon"],
  "Gorontalo": ["Gorontalo"],
  "Sulawesi Tengah": ["Palu"],
  "Sulawesi Barat": ["Mamuju"],
  "Sulawesi Selatan": ["Makassar", "Palopo", "Parepare"],
  "Sulawesi Tenggara": ["Bau-Bau", "Kendari"],
  "Maluku": ["Ambon", "Tual"],
  "Maluku Utara": ["Ternate", "Tidore Kepulauan"],
  "Papua": ["Jayapura"],
  "Papua Barat": ["Sorong", "Manokwari"]
}

TAMPILAN:
Dua row bertingkat:

Row 1 — Provinsi:
Label: "Provinsi" (font 11px uppercase tracking, warna #9C8B75)
Custom select dropdown (BUKAN <select> HTML biasa):
  - Trigger: bg #EDE4D3, border #D4C4A8, rounded-lg, padding 9px 12px
  - Teks terpilih: #3B2F1E, font 13px
  - Placeholder: "Pilih provinsi..." warna #9C8B75
  - Ikon: IconChevronDown di kanan, rotate 180° saat terbuka
  - Dropdown panel: bg #FDFAF5, border #D4C4A8, shadow-sm, rounded-lg, max-h-48, overflow-y-scroll
  - Item: padding 8px 12px, hover bg #EDE4D3, teks #3B2F1E, font 13px
  - Item aktif (terpilih): bg #D6EAD9, teks #2E5239, font-medium

Row 2 — Kota/Kabupaten:
Muncul hanya setelah provinsi dipilih.
Sama persis style-nya dengan provinsi.
Placeholder: "Pilih kota/kabupaten..."
List otomatis berubah berdasarkan provinsi yang dipilih.
Jika provinsi berubah, reset city ke kosong.

ANIMASI dropdown: opacity 0→1, translateY -4px→0, duration 150ms

SEARCH di dalam dropdown:
Input search kecil di atas list (sticky):
bg #F5F0E8, border-b #D4C4A8, padding 6px 10px
placeholder "Cari..." dengan ikon IconSearch kecil
Filter list real-time berdasarkan input

Close behavior: klik di luar dropdown menutupnya (gunakan useRef + useEffect)

=== MODIFIKASI TaarufProfileForm.tsx ===

1. Ganti field Lokasi (satu Input teks biasa) dengan:
   <LocationPicker
     value={{ province: personalData.province, city: personalData.city }}
     onChange={(val) => setPersonalData({ ...personalData, ...val })}
     required
   />

2. Update state personalData:
   Ganti: location: ''
   Menjadi: province: '', city: ''

3. Update handleNext / updateProfile:
   Kirim location: `${personalData.city}, ${personalData.province}`
   (tetap satu string untuk kompatibilitas BE)
   Juga kirim province dan city terpisah jika BE mendukung.

ATURAN:
- Tailwind CSS + Tabler Icons (@tabler/icons-react)
- JANGAN gunakan library select eksternal (react-select, dll) — buat custom
- Komponen LocationPicker harus bisa berdiri sendiri (tidak import dari form)
- Gunakan useRef untuk detect klik luar dropdown
- Output: dua file — LocationPicker.tsx dan TaarufProfileForm.tsx yang sudah dimodifikasi
```

---

## PROMPT 3 — Minat/Hobi: dinamis, kategorisasi, dan tampilan menarik

**Tujuan prompt ini:**
Ganti 6 pilihan hobi statis dengan sistem minat yang lengkap, terkategorisasi,
bisa search, dan tampilannya menarik secara visual.

```
Kamu adalah developer React + TypeScript.

Buat komponen baru `src/app/taaruf/components/InterestPicker.tsx`
dan modifikasi bagian Minat/Hobi di TaarufProfileForm.tsx untuk menggunakannya.

=== KOMPONEN InterestPicker.tsx ===

PROPS:
interface InterestPickerProps {
  selected: string[]
  onChange: (selected: string[]) => void
  max?: number                  // default 10 — max minat yang bisa dipilih
}

DATA MINAT (gunakan persis ini, dengan kategori):
const INTEREST_CATEGORIES = [
  {
    id: 'ibadah',
    label: 'Ibadah & Agama',
    icon: 'IconBook',           // Tabler icon name
    color: '#4A7C59',
    bgColor: '#D6EAD9',
    items: ['Tahsin Al-Qur\'an', 'Kajian Hadits', 'Fiqih', 'Tahfidz', 'Kajian Tafsir', 'Sholat Berjamaah', 'Sedekah & Wakaf']
  },
  {
    id: 'keluarga',
    label: 'Keluarga & Rumah',
    icon: 'IconHome',
    color: '#8B6F47',
    bgColor: '#EDE3D6',
    items: ['Memasak', 'Berkebun', 'Dekorasi Rumah', 'Parenting', 'Menjahit', 'DIY & Kerajinan', 'Tanaman Hias']
  },
  {
    id: 'ilmu',
    label: 'Ilmu & Wawasan',
    icon: 'IconBulb',
    color: '#2A6E6A',
    bgColor: '#D4EDEC',
    items: ['Membaca Buku', 'Menulis', 'Podcast', 'Dokumenter', 'Belajar Bahasa', 'Sejarah Islam', 'Sains & Teknologi']
  },
  {
    id: 'kesehatan',
    label: 'Kesehatan & Olahraga',
    icon: 'IconHeartbeat',
    color: '#C4922A',
    bgColor: '#F5E8C8',
    items: ['Olahraga Rutin', 'Hiking', 'Renang', 'Bersepeda', 'Yoga', 'Memasak Sehat', 'Herbal & Thibbun Nabawi']
  },
  {
    id: 'sosial',
    label: 'Sosial & Komunitas',
    icon: 'IconUsers',
    color: '#6B5B45',
    bgColor: '#EDE4D3',
    items: ['Relawan', 'Pengajian Lingkungan', 'Kegiatan Sosial', 'Dakwah', 'Mentoring', 'Organisasi']
  },
  {
    id: 'kreatif',
    label: 'Seni & Kreativitas',
    icon: 'IconPalette',
    color: '#8B6F47',
    bgColor: '#EDE3D6',
    items: ['Fotografi', 'Desain Grafis', 'Kaligrafi', 'Musik Islami (Nasyid)', 'Konten Kreator', 'Ilustrasi', 'Kerajinan Tangan']
  },
  {
    id: 'produktif',
    label: 'Produktivitas & Karir',
    icon: 'IconBriefcase',
    color: '#2E5239',
    bgColor: '#D6EAD9',
    items: ['Wirausaha', 'Investasi Halal', 'Public Speaking', 'Kepemimpinan', 'Project Management', 'Freelance']
  },
  {
    id: 'alam',
    label: 'Alam & Perjalanan',
    icon: 'IconMap',
    color: '#4A7C59',
    bgColor: '#D6EAD9',
    items: ['Travelling', 'Camping', 'Bird Watching', 'Snorkeling', 'Wisata Islami', 'Road Trip']
  }
]

TAMPILAN DAN INTERAKSI:

1. HEADER:
   Row: "Minat & Hobi" (label) di kiri + "{X}/{max} dipilih" di kanan (teks #9C8B75 font 11px)
   Jika selected.length >= max: tampilkan teks "Maksimum tercapai" warna #C4922A

2. SEARCH BAR:
   Input search full-width di atas kategori
   bg #EDE4D3, border #D4C4A8, rounded-full, padding 7px 12px
   Ikon IconSearch di kiri (teks #9C8B75)
   Placeholder: "Cari minat..."
   Saat search aktif: sembunyikan kategori, tampilkan flat list hasil filter dari SEMUA items

3. KATEGORI FILTER (chips horizontal scroll):
   Chip "Semua" + chip per kategori (label saja, tanpa ikon)
   Chip aktif: bg sesuai warna kategori, teks putih
   Chip non-aktif: bg #FDFAF5, border #D4C4A8, teks #6B5B45
   Scroll horizontal, no scrollbar visible

4. DAFTAR MINAT:
   Tampilkan per kategori yang dipilih (atau semua jika filter "Semua")
   
   Per kategori: header kategori dengan ikon + label (mini, teks 11px uppercase)
   
   Items dalam kategori: grid 2 kolom (flex-wrap gap-2)
   
   Per item chip:
   - Tidak terpilih: bg #FDFAF5, border #D4C4A8, teks #6B5B45
     padding 6px 12px, rounded-full, font 12px
   - Terpilih: bg sesuai kategori, teks putih, ada ikon IconCheck kecil di kiri
   - Disabled (max tercapai dan item ini tidak terpilih): opacity-40, cursor-not-allowed
   - Hover (tidak disabled): border warna kategori, bg light kategori

5. SELECTED SUMMARY (di bawah daftar):
   Hanya tampil jika selected.length > 0
   Label: "Dipilih:" (teks #9C8B75, font 11px)
   Row chips yang dipilih (wrappable):
     Chip: bg #EDE4D3, teks #3B2F1E, font 11px, ada tombol × di kanan untuk deselect

STATE INTERNAL:
- searchQuery: string
- activeCategory: string ('semua' | category.id)

ATURAN:
- Tailwind CSS + Tabler Icons (@tabler/icons-react)
- Dinamis import ikon dari Tabler berdasarkan nama string (gunakan map atau switch)
- Tidak ada fetch — semua data statis
- Komponen bisa berdiri sendiri
- Smooth transition saat pilih/deselect chip (scale 0.95 → 1)

=== MODIFIKASI TaarufProfileForm.tsx ===

1. Ganti bagian Minat/Hobi:
   Hapus hobbyOptions array dan fungsi toggleInterest
   Ganti dengan:
   <InterestPicker
     selected={personalData.interests}
     onChange={(interests) => setPersonalData({ ...personalData, interests })}
     max={10}
   />

2. Tidak ada perubahan lain di form — state interests tetap string[]

ATURAN OUTPUT:
- Dua file: InterestPicker.tsx dan TaarufProfileForm.tsx yang sudah dimodifikasi
- TaarufProfileForm.tsx di output ini sudah mengandung semua perubahan
  dari Prompt 1 (stepper) dan Prompt 2 (LocationPicker) — jadi file final
```

---

## Urutan pengerjaan

```
Prompt 1 → Selesaikan dan test di browser
           Pastikan stepper + progress bar tampil benar
           ↓
Prompt 2 → Buat LocationPicker.tsx dulu, test terpisah
           Lalu integrasikan ke TaarufProfileForm.tsx
           Test: pilih provinsi → kota berubah, reset ketika ganti provinsi
           ↓
Prompt 3 → Buat InterestPicker.tsx dulu, test terpisah
           Lalu integrasikan ke TaarufProfileForm.tsx (file final)
           Test: search, filter kategori, max limit, deselect dari summary
```

## Catatan penting untuk semua prompt

- **Jangan gunakan emoji** — semua ikon pakai Tabler Icons (`@tabler/icons-react`)
- **Jangan ubah token warna** — semua sudah benar, jangan ganti ke Tailwind default
- **Jangan install library baru** selain yang sudah ada — custom components semua
- **Output selalu file lengkap** — bukan patch/diff, tapi file siap pakai

