# Planning API — Kumandang Adzan Otomatis (CeritaKeluarga — Web/Next.js)

## 1. Tujuan
Membuat sistem yang secara otomatis memutar suara adzan di **web app CeritaKeluarga** (Next.js) tepat saat waktu Subuh, Dzuhur, Ashar, Maghrib, dan Isya tiba, berdasarkan lokasi geografis user (bukan sekadar zona waktu). Target awal: **website**. Mobile (React Native) menyusul di fase berikutnya (lihat bagian 9).

---

## 2. Konteks Penting: Keterbatasan Browser

Beda dari mobile app, di web:
- **Tidak ada background execution yang reliable** — begitu tab ditutup/browser di-minimize lama, JS timer (`setTimeout`/`setInterval`) berhenti jalan.
- **Audio tidak bisa diputar otomatis tanpa interaksi user** (autoplay policy browser) kecuali user sudah pernah berinteraksi dengan halaman (klik, dsb).
- **Service Worker** bisa terima Push Notification meski tab tertutup, TAPI **tidak bisa memutar audio panjang** dari dalam SW — hanya bisa tampilkan notifikasi native browser (dengan sound pendek bawaan OS, bukan file adzan custom).
- Karena itu perlu bedakan dua mode pengalaman:
  1. **Tab terbuka (foreground)** → bisa putar full audio adzan otomatis.
  2. **Tab tertutup/browser closed** → hanya bisa kirim Web Push Notification (klik notifikasi → buka web → baru bisa putar adzan).

---

## 3. Keputusan Arsitektur Utama

**Perhitungan waktu sholat tetap di CLIENT (browser), server hanya untuk preferensi + trigger push.**

- Saat tab/web terbuka: kalkulasi & scheduling waktu sholat dilakukan di client (JS), audio diputar langsung dari browser.
- Untuk notifikasi saat tab tertutup: perlu **server-side scheduler (cron job)** yang tahu waktu sholat tiap user (dihitung server juga, karena SW tidak bisa hitung sendiri saat sleep) lalu kirim **Web Push** persis di waktu itu.

Jadi arsitektur: **hybrid** — kalkulasi client untuk pengalaman real-time saat online, + kalkulasi & cron server untuk push notification saat user tidak sedang membuka web.

---

## 3. Komponen Sistem

### 3.1 Prayer Time Engine (dipakai di client & server)
- Library: `adhan.js` (npm, native JS — tinggal `npm install adhan`, cocok langsung untuk Next.js).
- Input: `latitude`, `longitude`, `date`, `timezone offset`, `calculation method`, `madhab` (Ashar: Syafi'i/Hanafi).
- Output: objek 5 waktu sholat + Syuruq dalam `Date`.
- Metode kalkulasi (pilihan user, disimpan di preferensi):
  - Kemenag RI (Subuh -20°, Isya -18°) — default untuk user Indonesia
  - Muslim World League, Umm al-Qura, ISNA, Egyptian (opsional lanjutan)
- **Dipakai dua kali**: sekali di client (real-time saat tab terbuka), sekali lagi di server/cron (untuk keperluan push saat tab tertutup) — logikanya sama persis (share 1 module/util agar tidak drift).

### 3.2 Location Service (Web)
- Ambil lokasi via **Geolocation API** browser (`navigator.geolocation.getCurrentPosition`), minta permission saat user aktifkan fitur adzan.
- Fallback: input kota manual (dropdown/search kota Indonesia) untuk user yang menolak permission lokasi — penting karena banyak browser/user cenderung deny geolocation.
- Simpan `latitude`/`longitude` (atau `city_id`) ke Supabase agar bisa dipakai server-side cron tanpa perlu tab terbuka.
- Re-fetch/prompt update lokasi jika user pindah kota (opsional, cek berkala saat tab dibuka).

### 3.3 Client-Side Scheduler (Tab Terbuka)
- Saat halaman dibuka & fitur adzan aktif: hitung 5 waktu sholat hari ini, lalu `setTimeout` per waktu sholat ke waktu tersisa dari `now()`.
- Saat lewat tengah malam atau tab reload: recompute otomatis.
- Ini yang menghasilkan pengalaman "real": begitu waktu tiba, browser langsung putar full audio adzan tanpa delay network.
- Gunakan `Page Visibility API` untuk cek apakah tab masih aktif/terlihat; kalau tab di-background terlalu lama, browser modern (Chrome/Firefox) bisa throttle timer — perlu fallback re-check waktu saat tab kembali visible (`visibilitychange` event) supaya tidak "telat besar" kalau timer di-throttle.

### 3.4 Web Push Notification (Tab Tertutup)
Untuk kasus user tidak sedang membuka website saat waktu sholat tiba:
- Gunakan **Web Push API + Service Worker** (`registerServiceWorker`, `PushManager.subscribe`).
- User perlu approve permission notifikasi browser sekali di awal.
- **Server (cron job / scheduled function)** menghitung waktu sholat tiap user terdaftar (berdasarkan lokasi tersimpan), lalu kirim push payload persis di waktu tersebut via **Web Push protocol** (library: `web-push` di Node.js, pakai VAPID keys).
- Push yang diterima Service Worker hanya bisa menampilkan **native browser notification** (judul + body + icon), dengan sound pendek bawaan OS — **tidak bisa memutar file audio adzan penuh** dari dalam SW.
- Kalau user klik notifikasi → browser buka tab CeritaKeluarga → di situ baru bisa auto-play full adzan (karena sudah ada trigger interaksi user dari klik notifikasi).

### 3.5 Audio Playback Module (Client)
- Gunakan `<audio>` element / **Web Audio API**, file adzan di-hosting di `/public/audio/adzan-*.mp3` atau storage Supabase.
- Autoplay browser policy: umumnya browser izinkan autoplay audio jika sebelumnya sudah ada interaksi user di halaman itu (klik apa saja). Solusinya: minta user klik tombol "Aktifkan Adzan" sekali saat setup fitur — itu "unlock" autoplay untuk sesi berikutnya.
- Sediakan kontrol: volume, mute per waktu sholat tertentu, pilih qori/variasi suara adzan.

### 3.6 Server API (Next.js API Routes / Supabase)
Server berperan penting di web karena harus cover kasus "tab tertutup".

**Endpoint yang diusulkan:**

| Method | Endpoint | Fungsi |
|---|---|---|
| GET | `/api/prayer-settings` | Ambil preferensi user (metode kalkulasi, madhab, lokasi tersimpan, adzan aktif/tidak per waktu) |
| PUT | `/api/prayer-settings` | Update preferensi |
| GET | `/api/prayer-times?lat=&lng=&date=` | Hitung waktu sholat (dipakai client untuk tampilan jadwal & sinkronisasi cek) |
| POST | `/api/push-subscription` | Simpan Push Subscription object (endpoint + keys) dari `PushManager.subscribe()` browser user |
| DELETE | `/api/push-subscription` | Hapus subscription (saat user nonaktifkan notifikasi) |
| POST | `/api/prayer-log` | (Opsional) catat histori adzan yang terputar, untuk fitur tracking ibadah keluarga di CeritaKeluarga |
| *(internal, cron)* | `/api/cron/send-adzan-push` | Dijalankan scheduler tiap menit — cek semua user, hitung apakah waktu sholat mereka jatuh di menit ini, kirim Web Push jika iya |

**Skema tabel Supabase (usulan):**

```sql
create table prayer_settings (
  user_id uuid references auth.users primary key,
  calculation_method text default 'kemenag',
  madhab text default 'shafi',
  latitude double precision,
  longitude double precision,
  city_name text,
  timezone text default 'Asia/Jakarta',
  adzan_enabled jsonb default '{"subuh":true,"dzuhur":true,"ashar":true,"maghrib":true,"isya":true}',
  sound_variant text default 'default',
  updated_at timestamptz default now()
);

create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz default now()
);
```

**Cron job (`/api/cron/send-adzan-push`):**
- Dipicu tiap 1 menit via **Vercel Cron** (kalau hosting di Vercel) atau `pg_cron`/external scheduler.
- Query semua user dengan `adzan_enabled` aktif → hitung waktu sholat hari ini pakai `adhan.js` (server-side, module yang sama dengan client) → bandingkan dengan waktu sekarang (toleransi ±30 detik karena cron granularity) → kalau match, kirim push via library `web-push` (Node.js) memakai VAPID keys ke tiap `push_subscriptions` milik user itu.

---

## 4. Alur (Flow) Sistem

**Alur A — Tab/Website terbuka (foreground):**
```
User buka CeritaKeluarga & aktifkan fitur adzan (klik tombol "Aktifkan")
        │
        ▼
Browser minta izin lokasi + izin notifikasi
        │
        ▼
Client hitung 5 waktu sholat hari ini (adhan.js + lat/long)
        │
        ▼
setTimeout dijadwalkan per waktu sholat
        │
        ▼
[Saat waktu tiba, tab masih terbuka] → putar full audio adzan langsung di browser
```

**Alur B — Tab/Website tertutup:**
```
User pernah subscribe push (browser simpan Push Subscription → dikirim ke server)
        │
        ▼
Server cron (tiap 1 menit) hitung waktu sholat semua user terdaftar
        │
        ▼
[Waktu sholat user cocok dengan waktu sekarang] → server kirim Web Push
        │
        ▼
Browser (walau tab tertutup) tampilkan native notification (sound pendek)
        │
        ▼
User klik notifikasi → tab CeritaKeluarga terbuka → auto-play full adzan (karena ada trigger klik)
```

---

## 5. Edge Cases yang Perlu Ditangani

- **Autoplay diblokir browser** kalau belum ada interaksi user sama sekali di sesi itu → wajib ada tombol eksplisit "Aktifkan Adzan" di awal untuk "unlock" izin autoplay.
- **Tab di-throttle browser** saat di-background lama (Chrome throttle timer >1 menit) → saat `visibilitychange` jadi visible lagi, cek ulang: kalau ternyata sudah lewat waktu sholat & belum diputar, putar segera (dengan catatan/label "adzan tertunda").
- **User pakai banyak tab CeritaKeluarga sekaligus** → hindari adzan diputar dobel; pakai `BroadcastChannel` API atau flag di `localStorage`/session untuk koordinasi antar tab.
- **Push notification permission ditolak** → fallback: tampilkan reminder waktu sholat di UI (badge/banner) saja, tanpa suara otomatis saat tab tertutup.
- **Device time user salah/tidak akurat** → idealnya pakai waktu server sebagai referensi (fetch `/api/server-time` sesekali) untuk koreksi drift, terutama untuk cron di server side (yang lebih kritikal karena itu sumber Web Push).
- **Perbedaan mazhab Ashar** (Syafi'i vs Hanafi) mengubah waktu Ashar ±1 jam.
- **Adzan Jumat** menggantikan Dzuhur di hari Jumat (opsional, jika ingin granular).
- **Safari/iOS Web Push** — dukungan Web Push di Safari (termasuk iOS Safari & PWA) berbeda dari Chrome/Firefox; perlu dicek kompatibilitas kalau target user banyak pakai iPhone (kemungkinan perlu APNs web push config terpisah).

---

## 6. Tech Stack Ringkas (Web)

| Layer | Tools |
|---|---|
| Kalkulasi waktu sholat | `adhan.js` (npm package, dipakai di client & server) |
| Lokasi | Geolocation API browser + fallback input kota manual |
| Client scheduler | `setTimeout` + `visibilitychange` reconciliation |
| Push (tab tertutup) | Service Worker + Web Push API + `web-push` (Node.js, VAPID) |
| Cron scheduler | Vercel Cron (kalau hosting Vercel) atau Supabase scheduled function |
| Audio | HTML5 `<audio>` / Web Audio API |
| Backend/preferensi | Supabase (Postgres + RLS) |
| Koordinasi multi-tab | `BroadcastChannel` API |

---

## 7. Fase Implementasi yang Disarankan (Web dulu)

1. **Fase 1** — Prayer Time Engine (`adhan.js`) + tampilkan 5 waktu sholat di UI CeritaKeluarga, validasi akurasi vs jadwal Kemenag resmi untuk beberapa kota sampel.
2. **Fase 2** — Client-side scheduler + audio full adzan saat tab terbuka (mode paling sederhana, langsung kasih value ke user tanpa perlu Service Worker dulu).
3. **Fase 3** — Setup Service Worker + Web Push (VAPID keys, subscription flow, permission UI).
4. **Fase 4** — Server cron job untuk push saat tab tertutup + tabel `push_subscriptions`.
5. **Fase 5** — Preferensi lengkap (metode kalkulasi, madhab, variasi suara) + opsional fitur family log ("siapa sudah sholat") untuk social feed CeritaKeluarga.
6. **Fase 6** — Edge case hardening (multi-tab koordinasi, throttle recovery, Safari/iOS compatibility check).

---

## 8. Catatan Tambahan
- Untuk akurasi tinggi, pertimbangkan opsi override manual per waktu sholat (user bisa geser ±beberapa menit sesuai jadwal masjid setempat, karena jadwal resmi kadang beda tipis dengan hasil kalkulasi murni).
- Fase 1 & 2 sudah cukup memberi value nyata (adzan otomatis saat user sedang buka web) tanpa kompleksitas Push/Service Worker — bisa jadi MVP dulu sebelum lanjut ke fase push notification.

---

## 9. Roadmap Lanjutan: Mobile (React Native/Expo)

Setelah versi web stabil, fitur ini bisa di-port ke mobile app dengan penyesuaian signifikan karena platform mobile punya kapabilitas background yang lebih baik (tapi beda mekanisme):

- **iOS**: local notifications terjadwal (`expo-notifications`), custom sound terbatas durasi, full audio umumnya perlu app foreground.
- **Android**: bisa pakai `AlarmManager` + foreground service untuk memutar full adzan bahkan saat app di-background/killed — jauh lebih reliable dibanding web.
- Module Prayer Time Engine (`adhan.js`) & skema Supabase preferensi bisa **di-reuse langsung** dari versi web — cukup ganti layer scheduler & audio playback sesuai platform.
- Detail lengkap perhitungan waktu sholat, metode kalkulasi, dan skema data sudah dibahas di planning versi awal (mobile-oriented) — tinggal disesuaikan saat waktunya tiba.
