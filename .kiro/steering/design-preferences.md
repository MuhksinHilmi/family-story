---
inclusion: always
---

# Design Preferences — Muhksin

Preferensi design dan development style yang harus diikuti di semua project.

## Visual Style

- **Tema:** Sesuaikan dengan konteks project — warna bisa berbeda tiap project
- **Feel:** Modern, tidak kaku, breathing room yang luas, tidak ramai
- **Referensi warna Growkita** (sebagai contoh implementasi, bukan wajib):
  - Background: `#2A2C28` (dark olive)
  - Text: `#F3F1E6` (paper/cream)
  - Aksen gold: `#C9A23B`
  - Aksen hijau: `#8FD17A` (sprout)
  - Ink: `#141A13`
- **Font:** Bebas pilih per project — Growkita pakai Fraunces (display) + Public Sans (body)

## Animasi & Interaksi

- **Prinsip:** Animasi harus memberi konteks, bukan sekadar dekoratif
- **Teknik scroll:** Scroll-triggered animations via `requestAnimationFrame` + lerp — **tanpa library berat** (tidak pakai GSAP, Framer Motion, dll kecuali diminta eksplisit)
- **Video scrubbing:** `currentTime` di-lerp setiap frame untuk smooth playback. Video di-encode dengan `-g 1 -keyint_min 1` (all-keyframe) agar seeking instan
- **Reveal pattern:** `.reveal-up` — fade + translateY(28px) → 0 saat masuk viewport
- **Staggered reveals:** delay 80–120ms per item
- **Hover states:** subtle transform (`-translate-y-0.5` atau `-translate-y-1`) + shadow
- **Transitions:** `duration-300` untuk micro-interactions, `duration-500–700` untuk entrance animations
- Semua animasi skip otomatis jika `prefers-reduced-motion: reduce` aktif

## Layout

- **Max width konten:** `max-w-[1120px]` dengan `mx-auto px-8`
- **Section spacing:** `py-28` hingga `py-32`
- **Grid:** Tailwind grid, alternating layout untuk step-by-step content
- **Sticky scroll sections:** `height: 300vh` dengan inner `sticky top-0 h-screen` untuk efek scroll-scrub

## Komponen Pattern

- **Video hero:** Section `height:250–350vh`, video sticky full viewport, scrim gradient, teks di bawah
- **Card:** `rounded-2xl`, border `border-paper/10`, background `bg-paper/5`, hover `border-gold/40`
- **Button primer:** Gold, `rounded-full`, `px-8 py-4`, text ink
- **Button sekunder:** Transparent, text muted, hover text lebih terang
- **Badge/label:** `rounded-full`, border tipis, background sangat transparan
- **Navbar:** Fixed, transparan di top, solid + `backdrop-blur` setelah scroll 40px

## Tech Stack Preferensi

- **Framework:** Astro (hybrid mode — static default, SSR on-demand jika butuh)
- **Styling:** Tailwind CSS v4
- **Scripting:** TypeScript vanilla — tidak pakai React/Vue kecuali kompleksitas membutuhkan
- **Data lokal:** IndexedDB via Dexie.js untuk offline-first features
- **Backend (jika perlu):** Supabase — free tier, no lock-in, bisa self-host di VPS
- **Package manager:** Yarn v4 (PnP)
- **Video encoding untuk scrub:** `ffmpeg -vcodec libx264 -g 1 -keyint_min 1 -sc_threshold 0 -movflags faststart`

## Prinsip Produk

- **Local-first:** Fitur harus bisa dipakai tanpa akun. Data lokal dulu, sync ke server opsional
- **Progresif:** User mulai tanpa hambatan, fitur lanjut muncul secara natural
- **Bukan sosmed:** Konten terikat pada data nyata, bukan feed bebas
- **Privasi lokasi:** Selalu approksimasi, presisi hanya dengan consent eksplisit

## Copy Style

- Bahasa Indonesia, hangat, tidak formal tapi tidak slang
- Kalimat pendek, tidak bertele-tele
- Headline pakai line break yang disengaja untuk irama visual
