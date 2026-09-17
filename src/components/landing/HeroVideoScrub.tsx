"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

/**
 * Hero Video Scrub — Bi-directional Locked Scroll
 * ─────────────────────────────────────────────────
 * State machine:
 *
 *   LOCKED   → progress 0→1, wheel intercepted, halaman tidak scroll
 *   UNLOCKED → progress sudah 1, halaman scroll bebas ke bawah
 *   RE-LOCK  → kalau scroll balik ke atas dan section visible lagi,
 *              lock aktif lagi dan video bisa mundur (progress 1→0)
 *
 * Teks overlay TIDAK pernah hilang (tidak ada scrollHideAt fade).
 * Teks muncul bertahap seiring progress, dan tetap visible di akhir.
 */

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

// Setiap tick scroll: progress bertambah sebesar delta * SCROLL_SENSITIVITY,
// supaya gerakan video terasa proporsional dengan kecepatan scroll.
const SCROLL_SENSITIVITY = 0.0015;

// Delta minimum agar dihitung satu "tick". Mencegah micro-movement trackpad
// yang tidak sengaja terhitung.
const MIN_DELTA = 1.5;

// Delay unlock setelah progress = 1 (ms)
const UNLOCK_DELAY = 350;

export function HeroVideoScrub() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const rafRef = useRef<number | null>(null);

  const progressRef = useRef(0); // 0–1, sumber kebenaran
  const targetTimeRef = useRef(0); // target video.currentTime
  const currentTimeRef = useRef(0); // lerped currentTime

  const [progress, setProgress] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  // locked = true  → wheel intercepted, halaman tidak scroll
  // locked = false → halaman scroll bebas
  const lockedRef = useRef(true);
  const [locked, setLocked] = useState(true);
  const unlockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const touchStartY = useRef(0);

  // ── prefers-reduced-motion ─────────────────────────────────────
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) {
      setReducedMotion(true);
      lockedRef.current = false;
      setLocked(false);
    }
  }, []);

  // ── Helpers ────────────────────────────────────────────────────

  /** Apakah section hero sedang di dalam viewport (terlepas dari locked state) */
  const isSectionInView = () => {
    const section = sectionRef.current;
    if (!section) return false;
    const rect = section.getBoundingClientRect();
    // Section "aktif" jika top-nya <= 0 (sudah ter-scroll ke atas)
    // dan bottom-nya masih di layar
    return rect.top <= 10 && rect.bottom > 0;
  };

  /** Update progress dan sinkronkan ke video.
   *  delta: raw wheel delta — kali SCROLL_SENSITIVITY supaya
   *  scroll cepat memicu progress cepat, scroll pelan mulus.
   */
  const applyDelta = (delta: number) => {
    if (Math.abs(delta) < MIN_DELTA) return;
    const video = videoRef.current;
    const newP = Math.min(
      Math.max(progressRef.current + delta * SCROLL_SENSITIVITY, 0),
      1,
    );
    progressRef.current = newP;
    setProgress(newP);

    if (video && !isNaN(video.duration)) {
      targetTimeRef.current = newP * video.duration;
    }
  };

  /** Lock: intercept wheel, halaman tidak scroll */
  const lock = () => {
    if (lockedRef.current) return;
    if (unlockTimerRef.current) {
      clearTimeout(unlockTimerRef.current);
      unlockTimerRef.current = null;
    }
    lockedRef.current = true;
    setLocked(true);
  };

  /** Unlock: lepas intercept, halaman scroll bebas */
  const unlock = () => {
    lockedRef.current = false;
    setLocked(false);
    unlockTimerRef.current = null;
  };

  // ── Wheel & Touch intercept ────────────────────────────────────
  useEffect(() => {
    if (reducedMotion) return;

    const onWheel = (e: WheelEvent) => {
      const inView = isSectionInView();
      const isLocked = lockedRef.current;
      const p = progressRef.current;

      // ── Kasus 1: locked & in view → intercept ──────────────────
      if (isLocked && inView) {
        e.preventDefault();
        applyDelta(e.deltaY);

        // Progress mencapai 1 → jadwalkan unlock
        if (progressRef.current >= 1) {
          if (!unlockTimerRef.current) {
            unlockTimerRef.current = setTimeout(unlock, UNLOCK_DELAY);
          }
        }
        // Batalkan unlock kalau user scroll balik sebelum unlock
        if (progressRef.current < 1 && unlockTimerRef.current) {
          clearTimeout(unlockTimerRef.current);
          unlockTimerRef.current = null;
        }
        return;
      }

      // ── Kasus 2: tidak locked, user scroll ke atas → re-lock ───
      // Kondisi: halaman sudah di section (dalam view) dan scroll atas
      if (!isLocked && inView && e.deltaY < 0 && p >= 0.98) {
        // User balik ke hero dari bawah
        e.preventDefault();
        lock();
        applyDelta(e.deltaY);
        return;
      }

      // ── Kasus 3: locked tapi scroll ke atas sebelum unlock selesai
      if (isLocked && inView && e.deltaY < 0) {
        e.preventDefault();
        applyDelta(e.deltaY);

        // Kalau progress turun ke 0, unlock ke atas (scroll ke sebelum section)
        // Biarkan halaman scroll normal
        if (progressRef.current <= 0) {
          unlock();
        }
        return;
      }
    };

    const onTouchStart = (e: TouchEvent) => {
      touchStartY.current = e.touches[0].clientY;
    };

    const onTouchMove = (e: TouchEvent) => {
      const inView = isSectionInView();
      const isLocked = lockedRef.current;
      if (!inView && !isLocked) return;

      const delta = touchStartY.current - e.touches[0].clientY;
      touchStartY.current = e.touches[0].clientY;

      if (isLocked && inView) {
        e.preventDefault();
        // Touch: MIN_DELTA lebih rendah (4px) karena jari bergerak kecil-kecil
        if (Math.abs(delta) >= 4) applyDelta(delta);

        if (progressRef.current >= 1 && !unlockTimerRef.current) {
          unlockTimerRef.current = setTimeout(unlock, UNLOCK_DELAY);
        }
        if (progressRef.current < 1 && unlockTimerRef.current) {
          clearTimeout(unlockTimerRef.current);
          unlockTimerRef.current = null;
        }
        if (progressRef.current <= 0 && delta < 0) unlock();
      }
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });

    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      if (unlockTimerRef.current) clearTimeout(unlockTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion]);

  // ── RAF lerp loop ──────────────────────────────────────────────
  useEffect(() => {
    if (reducedMotion) return;

    const tick = () => {
      const video = videoRef.current;
      if (video && !isNaN(video.duration)) {
        currentTimeRef.current = lerp(
          currentTimeRef.current,
          targetTimeRef.current,
          0.2,
        );
        if (Math.abs(currentTimeRef.current - video.currentTime) > 0.008) {
          video.currentTime = currentTimeRef.current;
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [reducedMotion]);

  // ── Visibility thresholds ──────────────────────────────────────
  // Teks muncul bertahap, TIDAK pernah hilang
  const badgeVisible = progress >= 0 || reducedMotion;
  const h1Visible = progress >= 0.08 || reducedMotion;
  const subVisible = progress >= 0.22 || reducedMotion;
  const ctaVisible = progress >= 0.42 || reducedMotion;

  return (
    <section ref={sectionRef} className="ck-hero" aria-label="Hero">
      <div className="ck-hero-sticky">
        {/* Poster fallback */}
        <img
          src="/images/hero-background.jpg"
          alt=""
          aria-hidden="true"
          className="ck-hero-poster"
        />

        {/* Video */}
        <video
          ref={videoRef}
          src="/videos/hero-scrub.mp4"
          muted
          playsInline
          preload="auto"
          aria-hidden="true"
          className="ck-hero-video"
          style={{ opacity: reducedMotion ? 0 : 1 }}
        />

        {/* Scrim */}
        <div className="ck-hero-scrim" aria-hidden="true" />

        {/* Overlay — opacity selalu 1, tidak ada fade-out */}
        <div className="ck-hero-overlay">
          <h1 className={`ck-hero-h1${h1Visible ? " visible" : ""}`}>
            Setiap tahun kita kumpul bersama keluarga.
            <br />
            <em>Tapi, sudahkah kita kenal semuanya?</em>
          </h1>

          <p className={`ck-hero-sub${subVisible ? " visible" : ""}`}>
            Ada nama yang mulai lupa. Ada cerita keluarga yang cuma tersimpan di
            ingatan seseorang.
          </p>
          <br />
          <strong className={`ck-hero-cta${ctaVisible ? " visible" : ""}`}>
            Yuk, mulai rangkai cerita keluarga kita.
          </strong>
        </div>

        {/* Scroll hint — hanya di awal */}
        {progress < 0.04 && (
          <div className="ck-hero-scroll-hint" aria-hidden="true">
            <span>Gulir</span>
            <svg
              className="ck-hero-scroll-arrow"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path
                d="M12 5v14M5 12l7 7 7-7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        )}

        {/* Progress bar tipis di bawah */}
        {locked && progress > 0.01 && (
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              height: 2,
              width: `${progress * 100}%`,
              background: "var(--ck-gold)",
              opacity: 0.5,
              transition: "width 0.08s linear",
              zIndex: 10,
            }}
          />
        )}

        {/* Hint "terus gulir" menjelang akhir */}
        {locked && progress >= 0.88 && progress < 1 && (
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              bottom: "1.75rem",
              left: "50%",
              transform: "translateX(-50%)",
              fontSize: "0.625rem",
              fontWeight: 600,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "rgba(242,235,217,0.45)",
              animation: "ck-float 1.5s ease-in-out infinite",
              whiteSpace: "nowrap",
            }}
          >
            Terus gulir ↓
          </div>
        )}
      </div>
    </section>
  );
}
