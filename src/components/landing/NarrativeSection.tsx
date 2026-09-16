"use client";

import { useEffect, useRef } from "react";

/**
 * Narrative Section — dark cinematic, serif besar
 * Ringkas, dalam, mengalir seperti ingatan lebaran.
 */
export function NarrativeSection() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add("is-visible");
        });
      },
      { threshold: 0.12 },
    );
    const els = ref.current?.querySelectorAll(".reveal-up");
    els?.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={ref}
      className="ck-narrative"
      style={{ background: "var(--ck-bg)" }}
    >
      <div className="ck-container" style={{ maxWidth: 680 }}>
        {/* Eyebrow */}
        <p className="ck-narrative-eyebrow reveal-up">Kenapa kami ada</p>

        {/* Opening — gambar yang langsung terasa */}
        <h2
          className="ck-narrative-question reveal-up reveal-delay-1"
          style={{ fontSize: "clamp(1.6rem, 4vw, 2.75rem)" }}
        >
          Rumah nenek penuh sandal —
          <br />
          <em>Tapi kamu lupa nama om-nya.</em>
        </h2>

        <div className="ck-narrative-divider reveal-up reveal-delay-2" />

        {/* Beat 1 */}
        <p className="ck-narrative-body reveal-up reveal-delay-2">
          Bau ketupat dari dapur. Anak-anak salim satu-satu. Kamu bisik ke
          sepupu —{" "}
          <em style={{ color: "rgba(242,235,217,0.75)", fontStyle: "italic" }}>
            "itu siapa ya? kita manggil om, tapi om siapa?"
          </em>
        </p>

        {/* Beat 2 */}
        <p className="ck-narrative-body reveal-up reveal-delay-3">
          Di dinding, foto lama yang sudah memutih. Orang-orang yang{" "}
          <strong>katanya masih keluarga</strong> — tapi kamu tak pernah
          meraba <em>benang ikatan mereka</em>.
        </p>

        {/* Beat 3 — emotional peak */}
        <p
          className="ck-narrative-body reveal-up reveal-delay-3"
          style={{ color: "rgba(242,235,217,0.82)", fontWeight: 400 }}
        >
          Biasanya cuma <strong>seorang</strong> yang masih ingat segalanya
          — nenek, kakek, atau tante tertua.
          <strong>
            {" "}
            Begitu beliau pergi, pertanyaan-pertanyaan itu{" "}
            <em>pun menghilang bersama</em>.
          </strong>
        </p>

        <div className="ck-narrative-divider reveal-up reveal-delay-4" />

        {/* Penutup — bukan solusi, tapi undangan */}
        <p
          className="ck-narrative-body reveal-up reveal-delay-4"
          style={{
            color: "rgba(242,235,217,0.9)",
            fontSize: "1.0625rem",
            fontWeight: 400,
            lineHeight: 1.85,
          }}
        >
          Bukan karena kita tidak peduli.
          <br />
          Tapi karena <strong>tak ada tempat yang menyimpan semua ini.</strong>
        </p>

        {/* Call-forward */}
        <p
          className="ck-narrative-body reveal-up reveal-delay-5"
          style={{
            color: "var(--ck-gold)",
            fontFamily: "var(--font-display)",
            fontStyle: "italic",
            fontSize: "clamp(1.1rem, 2.5vw, 1.375rem)",
            fontWeight: 500,
            marginTop: "2rem",
            lineHeight: 1.5,
          }}
        >
          Cerita Keluarga ada supaya cerita
          <br />
          tidak ikut pergi bersama beliau.
        </p>
      </div>
    </section>
  );
}
