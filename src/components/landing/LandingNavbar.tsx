"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export function LandingNavbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav className={`ck-nav${scrolled ? " scrolled" : ""}`}>
      <Link href="/" className="ck-nav-brand">
        <img
          src="/images/logo-cerita-keluarga.png"
          alt="Cerita Keluarga"
          className="ck-nav-logo"
        />
        Cerita Keluarga
      </Link>

      <div className="ck-nav-links">
        <Link href="/auth/login" className="ck-nav-ghost">
          Masuk
        </Link>
        <Link href="/auth/register" className="ck-nav-cta">
          Mulai Ceritamu
        </Link>
      </div>
    </nav>
  );
}
