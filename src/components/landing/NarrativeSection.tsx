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
          Suatu hari, kamu mungkin akan bertanya… —
          <br />
          <em>“Itu siapa, ya?”</em>
        </h2>

        <div className="ck-narrative-divider reveal-up reveal-delay-2" />

        {/* Beat 1 */}
        <p className="ck-narrative-body reveal-up reveal-delay-2">
          Rumah nenek ramai. Sandal memenuhi teras. Bau masakan dari dapur.
          Foto-foto lama masih tergantung di dinding. —{" "}
          <em style={{ color: "rgba(242,235,217,0.75)", fontStyle: "italic" }}>
            Kita tahu mereka keluarga.
          </em>
        </p>

        {/* Beat 2 */}
        <p className="ck-narrative-body reveal-up reveal-delay-3">
          Ada nama yang mulai <strong>terlupa</strong>. Ada foto yang{" "}
          <strong>tak lagi punya cerita.</strong> Ada hubungan yang{" "}
          <strong>hanya diketahui oleh satu orang</strong>. Orang-orang yang{" "}
          <strong>katanya masih keluarga</strong> — tapi kamu tak pernah tahu{" "}
          <em>
            <strong>benang ikatan yang terhubung ke mereka</strong>
          </em>
          .
        </p>

        {/* Beat 3 — emotional peak */}
        <p
          className="ck-narrative-body reveal-up reveal-delay-3"
          style={{ color: "rgba(242,235,217,0.82)", fontWeight: 400 }}
        >
          Biasanya cuma <strong>seorang</strong> yang masih ingat segalanya —
          nenek, kakek, hingga buyut.
          <strong>
            {" "}
            Begitu beliau pergi, pertanyaan-pertanyaan itu{" "}
            <em>pun menghilang bersamanya</em>.
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
          Cerita Keluarga ada agar cerita
          <br />
          ini tetap berlanjut.
        </p>
      </div>
    </section>
  );
}
