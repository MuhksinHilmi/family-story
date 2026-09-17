"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type LandingStatKey =
  | "registeredFamilies"
  | "connectedMembers"
  | "marriedCouples";

type LandingStats = Record<LandingStatKey, number>;

const STAT_DEFINITIONS = [
  { key: "registeredFamilies", label: "Keluarga Besar Terdaftar" },
  { key: "connectedMembers", label: "Keluarga Terhubung" },
  { key: "marriedCouples", label: "Pasangan Menikah" },
] as const;

function useCountUp(target: number, duration = 1800, active = false) {
  const [val, setVal] = useState(0);

  useEffect(() => {
    if (!active) return;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(eased * target));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [active, target, duration]);

  return val;
}

function StatItem({
  target,
  label,
  active,
}: {
  target: number;
  label: string;
  active: boolean;
}) {
  const val = useCountUp(target, 1800, active);
  return (
    <div style={{ textAlign: "center" }}>
      <span className="ck-stat-num">
        {val.toLocaleString("id-ID")}
        {val >= 1000 ? "+" : ""}
      </span>
      <span className="ck-stat-label">{label}</span>
    </div>
  );
}

export function StatsSection() {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const [stats, setStats] = useState<LandingStats | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/landing-stats")
      .then((response) => {
        if (!response.ok) throw new Error("Failed to load landing stats");
        return response.json() as Promise<LandingStats>;
      })
      .then((data) => {
        if (!cancelled) setStats(data);
      })
      .catch(() => {
        if (!cancelled) {
          setStats({
            registeredFamilies: 0,
            connectedMembers: 0,
            marriedCouples: 0,
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

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
          {STAT_DEFINITIONS.map((stat) => (
            <StatItem
              key={stat.key}
              target={stats?.[stat.key] ?? 0}
              label={stat.label}
              active={active}
            />
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
