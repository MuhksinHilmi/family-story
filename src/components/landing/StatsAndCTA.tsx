"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

/* ─────────────────────────────────────────────
   STATS COUNTER
───────────────────────────────────────────── */
const STATS = [
  { target: 1000, suffix: "+", label: "Keluarga Terdaftar" },
  { target: 5000, suffix: "+", label: "Anggota Terhubung" },
  { target: 150, suffix: "+", label: "Kota di Indonesia" },
];

function useCountUp(target: number, duration = 1800, active = false) {
  const [val, setVal] = useState(0);

  useEffect(() => {
    if (!active) return;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(eased * target));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [active, target, duration]);

  return val;
}

function StatItem(
  { target, suffix, label }: (typeof STATS)[0] & { active: boolean },
  active: boolean,
) {
  const val = useCountUp(target, 1800, active);
  return (
    <div style={{ textAlign: "center" }}>
      <span className="ck-stat-num">
        {val.toLocaleString("id-ID")}
        {suffix}
      </span>
      <span className="ck-stat-label">{label}</span>
    </div>
  );
}

function SingleStat({
  target,
  suffix,
  label,
  active,
}: (typeof STATS)[0] & { active: boolean }) {
  const val = useCountUp(target, 1800, active);
  return (
    <div style={{ textAlign: "center" }}>
      <span className="ck-stat-num">
        {val.toLocaleString("id-ID")}
        {suffix}
      </span>
      <span className="ck-stat-label">{label}</span>
    </div>
  );
}

export function StatsSection() {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setActive(true);
      },
      { threshold: 0.3 },
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={ref} className="ck-stats">
      <div className="ck-container">
        <div className="ck-stats-grid">
          {STATS.map((s) => (
            <SingleStat key={s.label} {...s} active={active} />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   CTA SECTION
───────────────────────────────────────────── */
const PARTICLES = [
  {
    size: 4,
    top: "15%",
    left: "8%",
    dur: "5s",
    delay: "0s",
    color: "var(--ck-gold)",
    opacity: 0.25,
  },
  {
    size: 6,
    top: "70%",
    left: "12%",
    dur: "7s",
    delay: "1s",
    color: "var(--ck-sprout)",
    opacity: 0.2,
  },
  {
    size: 3,
    top: "30%",
    left: "88%",
    dur: "6s",
    delay: "0.5s",
    color: "var(--ck-gold)",
    opacity: 0.2,
  },
  {
    size: 5,
    top: "80%",
    left: "80%",
    dur: "8s",
    delay: "2s",
    color: "var(--ck-sprout)",
    opacity: 0.15,
  },
  {
    size: 4,
    top: "50%",
    left: "95%",
    dur: "5.5s",
    delay: "1.5s",
    color: "var(--ck-gold)",
    opacity: 0.18,
  },
  {
    size: 7,
    top: "10%",
    left: "50%",
    dur: "9s",
    delay: "0.3s",
    color: "var(--ck-gold)",
    opacity: 0.12,
  },
];

export function CTASection() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add("is-visible");
        }),
      { threshold: 0.15 },
    );
    const els = ref.current?.querySelectorAll(".reveal-up");
    els?.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={ref} className="ck-cta">
      {/* Decorative particles */}
      {PARTICLES.map((p, i) => (
        <div
          key={i}
          aria-hidden="true"
          className="ck-particle"
          style={
            {
              width: p.size,
              height: p.size,
              top: p.top,
              left: p.left,
              background: p.color,
              opacity: p.opacity,
              "--dur": p.dur,
              "--delay": p.delay,
            } as React.CSSProperties
          }
        />
      ))}

      <div className="ck-container ck-cta-inner">
        {/* Tiga masalah yang sudah dirasakan — masing-masing satu baris */}
        <div
          className="reveal-up"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.875rem",
            marginBottom: "3rem",
            maxWidth: 520,
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          {[
            {
              icon: "🌳",
              text: "Silsilah keluargamu makin kabur setiap generasi.",
            },
            {
              icon: "💍",
              text: "Mencari pasangan yang tepat, dengan cara yang benar.",
            },
            {
              icon: "📜",
              text: "Ingin tahu pembagian warisan yang seharusnya seperti apa.",
            },
          ].map((item, i) => (
            <div
              key={i}
              className={`reveal-up reveal-delay-${i + 1}`}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "0.875rem",
                padding: "1rem 1.25rem",
                borderRadius: "0.875rem",
                background: "rgba(242,235,217,0.04)",
                border: "1px solid rgba(242,235,217,0.07)",
                textAlign: "left",
              }}
            >
              <span
                style={{ fontSize: "1.125rem", lineHeight: 1.4, flexShrink: 0 }}
              >
                {item.icon}
              </span>
              <p
                style={{
                  fontSize: "0.9375rem",
                  fontWeight: 400,
                  color: "rgba(242,235,217,0.7)",
                  lineHeight: 1.6,
                  margin: 0,
                }}
              >
                {item.text}
              </p>
            </div>
          ))}
        </div>

        {/* Headline — undangan, bukan jualan */}
        <h2 className="ck-cta-h2 reveal-up reveal-delay-4">
          Kalau kamu merasakan salah satunya,
          <br />
          <em>kamu ada di tempat yang tepat.</em>
        </h2>

        {/* Subtext — tidak ada kata "gratis", "kartu kredit", atau "teknis" */}
        <p className="ck-cta-sub reveal-up reveal-delay-5">
          Mulai dari silsilah keluargamu.
          <br />
          Sisanya akan mengikuti.
        </p>

        <div
          className="reveal-up reveal-delay-5"
          style={{
            display: "flex",
            gap: "0.75rem",
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <Link
            href="/auth/register"
            className="ck-btn-primary"
            style={{ fontSize: "1rem", padding: "0.875rem 2.5rem" }}
          >
            Mulai Sekarang
          </Link>
          <Link
            href="/auth/login"
            className="ck-btn-ghost-light"
            style={{ fontSize: "1rem", padding: "0.875rem 2rem" }}
          >
            Sudah punya akun
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   FOOTER
───────────────────────────────────────────── */
export function LandingFooter() {
  return (
    <footer className="ck-footer">
      <div className="ck-container">
        <div className="ck-footer-grid">
          {/* Brand */}
          <div>
            <p className="ck-footer-brand">Cerita Keluarga</p>
            <p className="ck-footer-tagline">
              Platform silsilah, kenangan, dan warisan untuk keluarga Muslim
              Indonesia.
            </p>
          </div>

          {/* Fitur */}
          <div>
            <p className="ck-footer-col-title">Fitur</p>
            <Link href="/auth/register" className="ck-footer-link">
              Pohon Silsilah
            </Link>
            <Link href="/auth/register" className="ck-footer-link">
              Kenangan Keluarga
            </Link>
            <Link href="/auth/register" className="ck-footer-link">
              Chat Privat
            </Link>
            <Link href="/auth/register" className="ck-footer-link">
              Hitung Waris
            </Link>
            <Link href="/auth/register" className="ck-footer-link">
              Ta'aruf
            </Link>
          </div>

          {/* Akun */}
          <div>
            <p className="ck-footer-col-title">Akun</p>
            <Link href="/auth/register" className="ck-footer-link">
              Daftar Gratis
            </Link>
            <Link href="/auth/login" className="ck-footer-link">
              Masuk
            </Link>
          </div>
        </div>

        <div className="ck-footer-bottom">
          <p className="ck-footer-copy">
            © 2026 Cerita Keluarga. Semua hak dilindungi.
          </p>
          <p className="ck-footer-copy">
            Dibuat dengan cinta untuk keluarga Muslim Indonesia
          </p>
        </div>
      </div>
    </footer>
  );
}
