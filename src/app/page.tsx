import Link from "next/link";
import { rootStyles } from "@/components/ui/design-system";

export default function LandingPage() {
  return (
    <>
      <style>{rootStyles}</style>

      <div className="lp">
        {/* Navigation */}
        <nav className="lp-nav">
          <Link href="/" className="lp-brand">
            <svg
              className="lp-brand-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 22V12M12 12C12 12 8 10 6 6M12 12C12 12 16 10 18 6M6 6C8 4 10 2 12 2C14 2 16 4 18 6" />
              <path d="M8 18C9.5 17 11 16.5 12 16.5C13 16.5 14.5 17 16 18" />
            </svg>
            CeritaKeluarga
          </Link>
          <div className="lp-nav-links">
            <Link href="/auth/login" className="lp-btn-ghost">
              Masuk
            </Link>
            <Link href="/auth/register" className="lp-btn-solid">
              Daftar
            </Link>
          </div>
        </nav>

        {/* Hero */}
        <section className="lp-hero">
          <div className="lp-hero-bg" />
          <div className="lp-leaf" />
          <div className="lp-leaf" />
          <div className="lp-leaf" />
          <div className="lp-leaf" />
          <div className="lp-leaf" />

          <div className="lp-hero-tag">
            <svg
              className="lp-hero-tag-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            Khusus Keluarga Muslim Indonesia
          </div>

          <h1 className="lp-hero-h1">
            Satu tempat untuk semua
            <br />
            <em>cerita keluarga Anda</em>
          </h1>

          <p className="lp-hero-sub">
            Pohon silsilah interaktif, arsip kenangan, dan ruang komunikasi —
            semuanya dalam platform yang aman dan privat.
          </p>

          <div className="lp-hero-cta">
            <Link href="/auth/register" className="lp-btn-primary">
              Mulai Gratis
            </Link>
            <Link href="/auth/login" className="lp-btn-secondary">
              Masuk ke Akun
            </Link>
          </div>

          {/* Tree SVG Illustration */}
          <div className="lp-tree-wrap">
            <svg
              width="220"
              height="140"
              viewBox="0 0 220 140"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect
                x="105"
                y="80"
                width="10"
                height="50"
                rx="5"
                fill="#2C1F14"
                opacity="0.15"
              />
              <path
                d="M110 80 Q90 60 60 50"
                stroke="#2C1F14"
                strokeWidth="2.5"
                strokeLinecap="round"
                opacity="0.18"
                fill="none"
              />
              <path
                d="M110 80 Q130 55 160 48"
                stroke="#2C1F14"
                strokeWidth="2.5"
                strokeLinecap="round"
                opacity="0.18"
                fill="none"
              />
              <path
                d="M110 95 Q80 85 50 88"
                stroke="#2C1F14"
                strokeWidth="1.5"
                strokeLinecap="round"
                opacity="0.12"
                fill="none"
              />
              <path
                d="M110 95 Q140 85 170 88"
                stroke="#2C1F14"
                strokeWidth="1.5"
                strokeLinecap="round"
                opacity="0.12"
                fill="none"
              />
              <circle cx="110" cy="30" r="18" fill="#EAF3DE" />
              <circle
                cx="110"
                cy="30"
                r="18"
                stroke="#3B6D11"
                strokeWidth="1.5"
                opacity="0.4"
              />
              <text
                x="110"
                y="35"
                textAnchor="middle"
                fontFamily="Playfair Display"
                fontSize="10"
                fill="#3B6D11"
                fontStyle="italic"
              >
                Nenek
              </text>
              <circle cx="55" cy="50" r="14" fill="#FAEEDA" />
              <circle
                cx="55"
                cy="50"
                r="14"
                stroke="#BA7517"
                strokeWidth="1.2"
                opacity="0.4"
              />
              <text
                x="55"
                y="54"
                textAnchor="middle"
                fontFamily="DM Sans"
                fontSize="9"
                fill="#BA7517"
              >
                Ayah
              </text>
              <circle cx="162" cy="48" r="14" fill="#FAEEDA" />
              <circle
                cx="162"
                cy="48"
                r="14"
                stroke="#BA7517"
                strokeWidth="1.2"
                opacity="0.4"
              />
              <text
                x="162"
                y="52"
                textAnchor="middle"
                fontFamily="DM Sans"
                fontSize="9"
                fill="#BA7517"
              >
                Ibu
              </text>
              <circle cx="44" cy="88" r="11" fill="rgba(44,31,20,0.06)" />
              <circle
                cx="44"
                cy="88"
                r="11"
                stroke="#2C1F14"
                strokeWidth="1"
                opacity="0.2"
              />
              <text
                x="44"
                y="92"
                textAnchor="middle"
                fontFamily="DM Sans"
                fontSize="8"
                fill="#888780"
              >
                Anda
              </text>
              <circle cx="170" cy="88" r="11" fill="rgba(44,31,20,0.06)" />
              <circle
                cx="170"
                cy="88"
                r="11"
                stroke="#2C1F14"
                strokeWidth="1"
                opacity="0.2"
              />
              <text
                x="170"
                y="92"
                textAnchor="middle"
                fontFamily="DM Sans"
                fontSize="8"
                fill="#888780"
              >
                Adik
              </text>
              <circle cx="110" cy="80" r="3" fill="#3B6D11" opacity="0.3" />
            </svg>
          </div>
        </section>

        {/* Stats */}
        <div className="lp-stats">
          <div className="lp-stat">
            <span className="lp-stat-num">1000+</span>
            <span className="lp-stat-label">Keluarga Terdaftar</span>
          </div>
          <div className="lp-stat">
            <span className="lp-stat-num">5000+</span>
            <span className="lp-stat-label">Anggota Terhubung</span>
          </div>
          <div className="lp-stat">
            <span className="lp-stat-num">150+</span>
            <span className="lp-stat-label">Kota di Indonesia</span>
          </div>
        </div>

        {/* Features */}
        <section className="lp-features">
          <p className="lp-feat-label">Yang Kami Tawarkan</p>
          <h2 className="lp-feat-title">
            Lengkap. <em>Sederhana. Bermakna.</em>
          </h2>
          <div className="lp-feat-grid">
            <div className="lp-feat-card">
              <div className={`lp-feat-icon lp-feat-icon-green`}>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M12 22V12M12 12C10 9 7 7 5 5M12 12C14 9 17 7 19 5" />
                </svg>
              </div>
              <h3>Pohon Silsilah</h3>
              <p>Visualisasi interaktif yang bisa di-zoom dan diedit bebas.</p>
            </div>
            <div className="lp-feat-card">
              <div className={`lp-feat-icon lp-feat-icon-gold`}>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <h3>Chat Keluarga</h3>
              <p>Ruang komunikasi privat hanya untuk anggota keluarga.</p>
            </div>
            <div className="lp-feat-card">
              <div className={`lp-feat-icon lp-feat-icon-bark`}>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M9 9h6M9 13h6M9 17h4" />
                </svg>
              </div>
              <h3>Arsip Digital</h3>
              <p>Dokumen, foto, dan kenangan tersimpan aman selamanya.</p>
            </div>
            <div className="lp-feat-card">
              <div className={`lp-feat-icon lp-feat-icon-green`}>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <circle cx="9" cy="7" r="4" />
                  <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75M21 21v-2a4 4 0 0 0-3-3.87" />
                </svg>
              </div>
              <h3>Undang Anggota</h3>
              <p>Tambah anggota dengan tautan undangan khusus.</p>
            </div>
            <div className="lp-feat-card">
              <div className={`lp-feat-icon lp-feat-icon-gold`}>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <h3>Privasi Ketat</h3>
              <p>Enkripsi penuh, data Anda tidak dibagikan ke siapapun.</p>
            </div>
            <div className="lp-feat-card">
              <div className={`lp-feat-icon lp-feat-icon-bark`}>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <circle cx="18" cy="5" r="3" />
                  <circle cx="6" cy="12" r="3" />
                  <circle cx="18" cy="19" r="3" />
                  <path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" />
                </svg>
              </div>
              <h3>Bagikan Silsilah</h3>
              <p>Ekspor ke PDF atau bagikan tautan ke anggota keluarga.</p>
            </div>
          </div>
        </section>

        {/* CTA Banner */}
        <div className="lp-cta">
          <div className="lp-cta-inner">
            <h2>
              Mulai abadikan cerita
              <br />
              <em>keluarga Anda hari ini</em>
            </h2>
            <p>Gratis selamanya untuk pohon keluarga dasar.</p>
            <Link href="/auth/register" className="lp-btn-light">
              Buat Akun Gratis
            </Link>
          </div>
        </div>

        {/* Footer */}
        <footer className="lp-footer">
          <div className="lp-footer-brand">CeritaKeluarga</div>
          <p>2026 CeritaKeluarga. Semua hak dilindungi.</p>
        </footer>
      </div>
    </>
  );
}
