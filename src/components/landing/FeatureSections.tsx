"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

/**
 * useReveal — attaches IntersectionObserver to all .reveal-up inside a ref
 */
function useReveal(ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) e.target.classList.add("is-visible");
      }),
      { threshold: 0.12 }
    );
    const els = ref.current?.querySelectorAll(".reveal-up");
    els?.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
}

/* ─────────────────────────────────────────────
   SECTION 1 — Silsilah Keluarga
   image: pohon-silsilah.jpg  |  text kiri
───────────────────────────────────────────── */
export function SectionSilsilah() {
  const ref = useRef<HTMLDivElement>(null);
  useReveal(ref);

  return (
    <section ref={ref} className="ck-feature">
      <div className="ck-container">
        <div className="ck-feature-grid">
          {/* Teks */}
          <div>
            <p className="ck-feature-label reveal-up">Fitur 01</p>
            <h2 className="ck-feature-h2 reveal-up reveal-delay-1">
              Pohon Silsilah<br />
              <em>yang tumbuh bersama waktu</em>
            </h2>
            <p className="ck-feature-body reveal-up reveal-delay-2">
              Bukan sekadar diagram nama dan tanggal lahir.
              Di sini kamu bisa mencatat setiap orang — lengkap dengan cerita,
              foto, pekerjaan, dan relasinya ke anggota keluarga lain.
              Dari generasi kakek buyut sampai cucu yang baru lahir.
            </p>
            <p className="ck-feature-body reveal-up reveal-delay-2" style={{ marginBottom: "1.5rem" }}>
              Visualisasi interaktif yang bisa di-zoom bebas.
              Semua terhubung — dari keluarga inti sampai keluarga besar.
            </p>
            <Link href="/auth/register" className="ck-feature-link reveal-up reveal-delay-3">
              Mulai buat silsilahmu
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
          </div>

          {/* Image */}
          <div className="reveal-up reveal-delay-2" style={{ position: "relative" }}>
            <div className="ck-feature-glow ck-feature-glow-gold" />
            <div className="ck-feature-img-wrap">
              <img
                src="/images/pohon-silsilah.jpg"
                alt="Pohon silsilah keluarga"
                className="ck-feature-img"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   SECTION 2 — Kenangan & Feed
   image: chat.jpg (pakai sebagai kenangan)  |  text kanan (alternating)
───────────────────────────────────────────── */
export function SectionKenangan() {
  const ref = useRef<HTMLDivElement>(null);
  useReveal(ref);

  return (
    <section ref={ref} className="ck-feature">
      <div className="ck-container">
        <div className="ck-feature-grid reverse">
          {/* Teks */}
          <div>
            <p className="ck-feature-label reveal-up">Fitur 02</p>
            <h2 className="ck-feature-h2 reveal-up reveal-delay-1">
              Kenangan yang<br />
              <em>tidak akan hilang</em>
            </h2>
            <p className="ck-feature-body reveal-up reveal-delay-2">
              Foto ulang tahun. Video lebaran. Pesan suara nenek di malam Jumat.
              Semua bisa disimpan di sini — sebagai kenangan keluarga,
              bukan konten untuk dunia.
            </p>
            <p className="ck-feature-body reveal-up reveal-delay-2" style={{ marginBottom: "1.5rem" }}>
              Hanya anggota keluarga yang bisa melihat.
              Privat, aman, dan tersimpan selamanya.
            </p>
            <Link href="/auth/register" className="ck-feature-link reveal-up reveal-delay-3">
              Bagikan momen pertama
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
          </div>

          {/* Image */}
          <div className="reveal-up reveal-delay-2" style={{ position: "relative" }}>
            <div className="ck-feature-glow ck-feature-glow-sprout" />
            <div className="ck-feature-img-wrap">
              <img
                src="/images/chat.jpg"
                alt="Kenangan keluarga"
                className="ck-feature-img"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   SECTION 3 — Chat Keluarga
   Visual CSS: animated chat bubbles
───────────────────────────────────────────── */

const BUBBLES = [
  { side: "left",  name: "Nenek",  text: "Jangan lupa sholat Jumat ya, Nak 🤲", delay: "0.2s" },
  { side: "right", name: "Ayah",   text: "Siap Bu, sudah dalam perjalanan 🕌",   delay: "0.6s" },
  { side: "left",  name: "Kakak",  text: "Nanti makan siang di rumah nenek ya semua?", delay: "1.0s" },
  { side: "right", name: "Kamu",   text: "Ayo! Saya bawa es krim 🍦",            delay: "1.4s" },
  { side: "left",  name: "Ibu",    text: "Sudah masak opor dari tadi 😄",         delay: "1.8s" },
];

export function SectionChat() {
  const ref    = useRef<HTMLDivElement>(null);
  const visRef = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting && !visRef.current) {
            visRef.current = true;
            const bubbles = ref.current?.querySelectorAll(".ck-bubble");
            bubbles?.forEach((b, i) => {
              (b as HTMLElement).style.animationDelay = `${i * 0.4}s`;
              (b as HTMLElement).style.animationFillMode = "forwards";
            });
            e.target.classList.add("is-visible");
          }
          if (e.isIntersecting) e.target.classList.add("is-visible");
        });
      },
      { threshold: 0.12 }
    );
    const els = ref.current?.querySelectorAll(".reveal-up");
    els?.forEach((el) => observer.observe(el));
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={ref} className="ck-feature">
      <div className="ck-container">
        <div className="ck-feature-grid">
          {/* Teks */}
          <div>
            <p className="ck-feature-label reveal-up">Fitur 03</p>
            <h2 className="ck-feature-h2 reveal-up reveal-delay-1">
              Satu ruang chat<br />
              <em>hanya untuk keluarga</em>
            </h2>
            <p className="ck-feature-body reveal-up reveal-delay-2">
              Grup WhatsApp keluarga ramai — tapi pesan penting tenggelam
              di antara forward-an dan meme. Di sini berbeda.
            </p>
            <p className="ck-feature-body reveal-up reveal-delay-2" style={{ marginBottom: "1.5rem" }}>
              Chat privat untuk keluarga inti, keluarga besar, atau bahkan
              sub-grup tertentu. Semua terkontrol, rapi, dan hanya
              bisa diakses oleh yang benar-benar keluarga.
            </p>
            <Link href="/auth/register" className="ck-feature-link reveal-up reveal-delay-3">
              Buat ruang chat keluarga
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
          </div>

          {/* Chat bubbles visual */}
          <div
            className="reveal-up reveal-delay-2"
            style={{
              background: "var(--ck-surface)",
              border: "1px solid var(--ck-border)",
              borderRadius: "1.25rem",
              padding: "1.5rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
            }}
          >
            {/* Header mock */}
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "0.625rem",
              paddingBottom: "0.875rem",
              borderBottom: "1px solid var(--ck-border)",
              marginBottom: "0.25rem",
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%",
                background: "rgba(200,149,58,0.15)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="var(--ck-gold)" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <div>
                <p style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--ck-paper)" }}>
                  Keluarga Besar
                </p>
                <p style={{ fontSize: "0.6875rem", color: "var(--ck-muted)" }}>
                  12 anggota · aktif sekarang
                </p>
              </div>
              <div style={{ marginLeft: "auto" }}>
                <span style={{
                  width: 8, height: 8, borderRadius: "50%",
                  background: "var(--ck-sprout)",
                  display: "inline-block",
                }} />
              </div>
            </div>

            {BUBBLES.map((b, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: b.side === "right" ? "flex-end" : "flex-start",
                }}
              >
                <p className="ck-bubble-name">{b.name}</p>
                <div
                  className={`ck-bubble ${b.side}`}
                  style={{ animationDelay: b.delay }}
                >
                  {b.text}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   SECTION 4 — Warisan (Harta Waris Islam)
   Visual CSS: bar chart pembagian waris
───────────────────────────────────────────── */

const WARIS_BARS = [
  { label: "Istri",   pct: 0.125, display: "1/8" },
  { label: "Anak ♂",  pct: 0.583, display: "7/12" },
  { label: "Anak ♀",  pct: 0.292, display: "3/12" },
];

export function SectionWarisan() {
  const ref    = useRef<HTMLDivElement>(null);
  const visRef = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting && !visRef.current) {
            visRef.current = true;
            const fills = ref.current?.querySelectorAll(".ck-waris-bar-fill");
            fills?.forEach((f, i) => {
              setTimeout(() => {
                (f as HTMLElement).classList.add("animated");
                (f as HTMLElement).style.width =
                  `${WARIS_BARS[i]?.pct * 100}%`;
              }, i * 200 + 300);
            });
          }
          if (e.isIntersecting) e.target.classList.add("is-visible");
        });
      },
      { threshold: 0.15 }
    );
    const els = ref.current?.querySelectorAll(".reveal-up");
    els?.forEach((el) => observer.observe(el));
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={ref} className="ck-feature">
      <div className="ck-container">
        <div className="ck-feature-grid reverse">
          {/* Teks */}
          <div>
            <p className="ck-feature-label reveal-up">Fitur 04</p>
            <h2 className="ck-feature-h2 reveal-up reveal-delay-1">
              Warisan yang dibagi<br />
              <em>sesuai perintah Allah</em>
            </h2>
            <p className="ck-feature-body reveal-up reveal-delay-2">
              Urusan harta waris sering jadi sumber perselisihan keluarga.
              Bukan karena tidak ikhlas — tapi karena tidak tahu cara
              menghitungnya yang benar.
            </p>
            <p className="ck-feature-body reveal-up reveal-delay-2" style={{ marginBottom: "1.5rem" }}>
              Cerita Keluarga membantu menghitung pembagian waris
              sesuai fiqih mawaris Al-Quran. Adil, transparan,
              dan mudah dipahami semua anggota keluarga.
            </p>
            <Link href="/auth/register" className="ck-feature-link reveal-up reveal-delay-3">
              Pelajari fitur waris
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
          </div>

          {/* Waris visual */}
          <div
            className="reveal-up reveal-delay-2"
            style={{
              background: "var(--ck-surface)",
              border: "1px solid var(--ck-border)",
              borderRadius: "1.25rem",
              padding: "2rem",
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
            }}
          >
            {/* Header */}
            <div style={{ marginBottom: "0.5rem" }}>
              <p style={{
                fontSize: "0.6875rem", fontWeight: 600, letterSpacing: "0.1em",
                textTransform: "uppercase", color: "var(--ck-gold-muted)",
                marginBottom: "0.375rem",
              }}>
                Simulasi Pembagian
              </p>
              <p style={{ fontSize: "1.125rem", fontWeight: 600, color: "var(--ck-paper)", fontFamily: "var(--font-display)" }}>
                Harta: Rp 600.000.000
              </p>
            </div>

            {/* Bars */}
            {WARIS_BARS.map((bar, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "0.8125rem", color: "rgba(242,235,217,0.65)" }}>
                    {bar.label}
                  </span>
                  <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--ck-gold)" }}>
                    {bar.display} &nbsp;
                    <span style={{ color: "var(--ck-muted)", fontWeight: 400 }}>
                      = Rp {(600_000_000 * bar.pct).toLocaleString("id-ID")}
                    </span>
                  </span>
                </div>
                <div className="ck-waris-bar-track">
                  <div
                    className="ck-waris-bar-fill"
                    style={{
                      width: 0,
                      transition: `width 0.9s cubic-bezier(0.22,1,0.36,1) ${i * 0.2}s`,
                    }}
                  />
                </div>
              </div>
            ))}

            <p style={{
              fontSize: "0.6875rem", color: "var(--ck-muted)", marginTop: "0.5rem",
              borderTop: "1px solid var(--ck-border)", paddingTop: "0.875rem",
              lineHeight: 1.6,
            }}>
              Dihitung berdasarkan ilmu faraid (fiqih mawaris) sesuai
              Al-Quran Surat An-Nisa.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   SECTION 5 — Ta'aruf
   Visual CSS: dua lingkaran keluarga menyatu
───────────────────────────────────────────── */
export function SectionTaaruf() {
  const ref = useRef<HTMLDivElement>(null);
  useReveal(ref);

  return (
    <section ref={ref} className="ck-feature">
      <div className="ck-container">
        <div className="ck-feature-grid">
          {/* Teks */}
          <div>
            <div
              className="reveal-up"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.25rem 0.75rem",
                borderRadius: "999px",
                background: "rgba(107,191,90,0.1)",
                border: "1px solid rgba(107,191,90,0.2)",
                marginBottom: "1rem",
              }}
            >
              <span style={{ fontSize: "0.6875rem", color: "var(--ck-sprout)", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                Segera Hadir
              </span>
            </div>
            <h2 className="ck-feature-h2 reveal-up reveal-delay-1">
              Ta'aruf — perkenalan<br />
              <em>yang dimulai dari keluarga</em>
            </h2>
            <p className="ck-feature-body reveal-up reveal-delay-2">
              Keluarga baru dimulai dari perkenalan yang benar.
              Ta'aruf di sini bukan kencan — tapi mempertemukan
              dua keluarga besar dengan hormat dan adab.
            </p>
            <p className="ck-feature-body reveal-up reveal-delay-2" style={{ marginBottom: "1.5rem" }}>
              Dua pohon keluarga yang terpisah, diperkenalkan,
              dan jika Allah izinkan — bergabung menjadi satu keluarga besar.
            </p>
          </div>

          {/* Taaruf visual — dua lingkaran menyatu */}
          <div
            className="reveal-up reveal-delay-2"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: 280,
              position: "relative",
            }}
          >
            {/* Lingkaran kiri */}
            <div style={{
              width: 160, height: 160, borderRadius: "50%",
              border: "1px solid rgba(200,149,58,0.25)",
              background: "radial-gradient(circle at 60% 50%, rgba(200,149,58,0.12), transparent 70%)",
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              gap: "0.375rem",
              position: "absolute",
              left: "calc(50% - 120px)",
              zIndex: 2,
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
                stroke="var(--ck-gold)" strokeWidth="1.5" opacity={0.7}>
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
              </svg>
              <p style={{ fontSize: "0.6875rem", color: "var(--ck-gold)", fontWeight: 500 }}>
                Keluarga Pria
              </p>
            </div>

            {/* Lingkaran kanan */}
            <div style={{
              width: 160, height: 160, borderRadius: "50%",
              border: "1px solid rgba(107,191,90,0.25)",
              background: "radial-gradient(circle at 40% 50%, rgba(107,191,90,0.1), transparent 70%)",
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              gap: "0.375rem",
              position: "absolute",
              left: "calc(50% - 40px)",
              zIndex: 2,
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
                stroke="var(--ck-sprout)" strokeWidth="1.5" opacity={0.7}>
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
              </svg>
              <p style={{ fontSize: "0.6875rem", color: "var(--ck-sprout)", fontWeight: 500 }}>
                Keluarga Wanita
              </p>
            </div>

            {/* Titik tengah pertemuan */}
            <div style={{
              position: "absolute",
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 3,
              width: 32, height: 32, borderRadius: "50%",
              background: "var(--ck-surface2)",
              border: "1px solid rgba(242,235,217,0.15)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="var(--ck-paper)" strokeWidth="2">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
