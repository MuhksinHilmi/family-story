import Link from 'next/link';

export default function LandingPage() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&display=swap');

        :root {
          --cream: #F7F3EE;
          --bark: #2C1F14;
          --moss: #3B6D11;
          --moss-light: #EAF3DE;
          --gold: #BA7517;
          --gold-light: #FAEEDA;
          --muted: #888780;
        }

        .lp * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        .lp {
          font-family: 'DM Sans', sans-serif;
          background: var(--cream);
          color: var(--bark);
          min-height: 100vh;
          overflow-x: hidden;
        }

        /* NAV */
        .lp-nav {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1.25rem 2rem;
          background: var(--cream);
          border-bottom: 0.5px solid rgba(44, 31, 20, 0.12);
          position: sticky;
          top: 0;
          z-index: 50;
          backdrop-filter: blur(8px);
          animation: lp-fadeDown 0.6s ease both;
        }

        .lp-brand {
          display: flex;
          align-items: center;
          gap: 8px;
          font-family: 'Playfair Display', serif;
          font-size: 18px;
          font-weight: 700;
          color: var(--bark);
          text-decoration: none;
        }

        .lp-brand-icon {
          width: 22px;
          height: 22px;
          flex-shrink: 0;
        }

        .lp-nav-links {
          display: flex;
          gap: 8px;
        }

        .lp-btn-ghost {
          padding: 7px 16px;
          border-radius: 6px;
          font-family: 'DM Sans', sans-serif;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          border: 0.5px solid transparent;
          background: transparent;
          color: var(--bark);
          transition: background 0.2s;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
        }

        .lp-btn-ghost:hover {
          background: rgba(44, 31, 20, 0.06);
        }

        .lp-btn-solid {
          padding: 7px 18px;
          border-radius: 6px;
          font-family: 'DM Sans', sans-serif;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          border: none;
          background: var(--bark);
          color: var(--cream);
          transition: opacity 0.2s;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
        }

        .lp-btn-solid:hover {
          opacity: 0.85;
        }

        /* HERO */
        .lp-hero {
          position: relative;
          padding: 5rem 2rem 3rem;
          text-align: center;
          overflow: hidden;
        }

        .lp-hero-bg {
          position: absolute;
          inset: 0;
          pointer-events: none;
          opacity: 0.06;
          background-image:
            radial-gradient(circle at 20% 50%, #3B6D11 0%, transparent 50%),
            radial-gradient(circle at 80% 30%, #BA7517 0%, transparent 50%);
        }

        /* floating leaves */
        .lp-leaf {
          position: absolute;
          border-radius: 50% 0 50% 0;
          opacity: 0;
          animation: lp-floatLeaf var(--dur, 8s) var(--delay, 0s) ease-in-out infinite;
          pointer-events: none;
        }

        .lp-leaf:nth-child(1) { top: 10%; left: 15%; background: var(--moss); width: 8px; height: 8px; --dur: 9s; --delay: 0s; }
        .lp-leaf:nth-child(2) { top: 25%; left: 75%; background: var(--gold); width: 5px; height: 5px; --dur: 7s; --delay: 1.5s; }
        .lp-leaf:nth-child(3) { top: 60%; left: 8%; background: var(--moss); width: 6px; height: 6px; --dur: 10s; --delay: 3s; }
        .lp-leaf:nth-child(4) { top: 15%; left: 55%; background: var(--gold); width: 7px; height: 7px; --dur: 8s; --delay: 0.8s; }
        .lp-leaf:nth-child(5) { top: 70%; left: 85%; background: var(--moss); width: 5px; height: 5px; --dur: 11s; --delay: 2s; }

        @keyframes lp-floatLeaf {
          0% { transform: translateY(0) rotate(0deg); opacity: 0; }
          15% { opacity: 0.5; }
          85% { opacity: 0.3; }
          100% { transform: translateY(-60px) rotate(180deg); opacity: 0; }
        }

        .lp-hero-tag {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 14px;
          border-radius: 20px;
          background: var(--moss-light);
          color: var(--moss);
          font-size: 12px;
          font-weight: 500;
          letter-spacing: 0.04em;
          margin-bottom: 1.5rem;
          animation: lp-fadeUp 0.7s 0.2s ease both;
        }

        .lp-hero-tag-icon {
          width: 13px;
          height: 13px;
          flex-shrink: 0;
        }

        .lp-hero-h1 {
          font-family: 'Playfair Display', serif;
          font-size: clamp(2rem, 5vw, 3.2rem);
          line-height: 1.2;
          font-weight: 700;
          color: var(--bark);
          margin-bottom: 1.25rem;
          animation: lp-fadeUp 0.7s 0.35s ease both;
        }

        .lp-hero-h1 em {
          font-style: italic;
          color: var(--moss);
        }

        .lp-hero-sub {
          font-size: 15px;
          color: var(--muted);
          font-weight: 300;
          max-width: 380px;
          margin: 0 auto 2.5rem;
          line-height: 1.7;
          animation: lp-fadeUp 0.7s 0.5s ease both;
        }

        .lp-hero-cta {
          display: flex;
          gap: 10px;
          justify-content: center;
          flex-wrap: wrap;
          animation: lp-fadeUp 0.7s 0.65s ease both;
          margin-bottom: 3rem;
        }

        .lp-btn-primary {
          padding: 11px 26px;
          border-radius: 8px;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          border: none;
          background: var(--bark);
          color: var(--cream);
          transition: transform 0.2s, opacity 0.2s;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
        }

        .lp-btn-primary:hover {
          transform: translateY(-1px);
          opacity: 0.88;
        }

        .lp-btn-secondary {
          padding: 11px 26px;
          border-radius: 8px;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          border: 1px solid rgba(44, 31, 20, 0.25);
          background: transparent;
          color: var(--bark);
          transition: background 0.2s, transform 0.2s;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
        }

        .lp-btn-secondary:hover {
          background: rgba(44, 31, 20, 0.05);
          transform: translateY(-1px);
        }

        /* TREE ILLUSTRATION */
        .lp-tree-wrap {
          display: flex;
          justify-content: center;
          margin: 1.5rem 0 0;
          animation: lp-fadeUp 0.7s 0.8s ease both;
        }

        /* STATS */
        .lp-stats {
          display: flex;
          justify-content: center;
          gap: 2.5rem;
          flex-wrap: wrap;
          padding: 1.75rem 2rem;
          border-top: 0.5px solid rgba(44, 31, 20, 0.1);
          border-bottom: 0.5px solid rgba(44, 31, 20, 0.1);
          animation: lp-fadeUp 0.7s 1s ease both;
        }

        .lp-stat {
          text-align: center;
        }

        .lp-stat-num {
          font-family: 'Playfair Display', serif;
          font-size: 1.8rem;
          font-weight: 700;
          color: var(--bark);
          display: block;
        }

        .lp-stat-label {
          font-size: 12px;
          color: var(--muted);
          font-weight: 300;
        }

        /* FEATURES */
        .lp-features {
          padding: 4rem 2rem;
          background: #fff;
        }

        .lp-feat-label {
          text-align: center;
          font-size: 11px;
          letter-spacing: 0.1em;
          font-weight: 500;
          color: var(--muted);
          text-transform: uppercase;
          margin-bottom: 0.75rem;
        }

        .lp-feat-title {
          font-family: 'Playfair Display', serif;
          font-size: clamp(1.5rem, 3vw, 2rem);
          font-weight: 700;
          text-align: center;
          color: var(--bark);
          margin-bottom: 2.5rem;
        }

        .lp-feat-title em {
          font-style: italic;
          color: var(--moss);
        }

        .lp-feat-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 1px;
          border: 1px solid rgba(44, 31, 20, 0.1);
          border-radius: 12px;
          overflow: hidden;
          max-width: 620px;
          margin: 0 auto;
          background: rgba(44, 31, 20, 0.1);
        }

        .lp-feat-card {
          padding: 1.75rem 1.25rem;
          background: #fff;
          transition: background 0.25s;
          cursor: default;
        }

        .lp-feat-card:hover {
          background: var(--cream);
        }

        .lp-feat-icon {
          width: 36px;
          height: 36px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 0.875rem;
          flex-shrink: 0;
        }

        .lp-feat-icon svg {
          width: 18px;
          height: 18px;
        }

        .lp-feat-icon-green {
          background: var(--moss-light);
          color: var(--moss);
        }

        .lp-feat-icon-gold {
          background: var(--gold-light);
          color: var(--gold);
        }

        .lp-feat-icon-bark {
          background: rgba(44, 31, 20, 0.08);
          color: var(--bark);
        }

        .lp-feat-card h3 {
          font-size: 13px;
          font-weight: 500;
          color: var(--bark);
          margin-bottom: 4px;
        }

        .lp-feat-card p {
          font-size: 12px;
          color: var(--muted);
          font-weight: 300;
          line-height: 1.6;
        }

        /* CTA BANNER */
        .lp-cta {
          margin: 3rem 2rem;
          border-radius: 16px;
          background: var(--bark);
          padding: 3.5rem 2rem;
          text-align: center;
          position: relative;
          overflow: hidden;
        }

        .lp-cta::before {
          content: '';
          position: absolute;
          inset: 0;
          background:
            radial-gradient(ellipse at 30% 50%, rgba(59, 109, 17, 0.3) 0%, transparent 60%),
            radial-gradient(ellipse at 70% 50%, rgba(186, 117, 23, 0.2) 0%, transparent 60%);
          pointer-events: none;
        }

        .lp-cta-inner {
          position: relative;
          z-index: 1;
        }

        .lp-cta h2 {
          font-family: 'Playfair Display', serif;
          font-size: clamp(1.3rem, 3vw, 1.8rem);
          font-weight: 700;
          color: var(--cream);
          margin-bottom: 0.75rem;
        }

        .lp-cta h2 em {
          font-style: italic;
          color: #C9E09A;
        }

        .lp-cta p {
          font-size: 13px;
          color: rgba(247, 243, 238, 0.6);
          margin-bottom: 1.75rem;
          font-weight: 300;
        }

        .lp-btn-light {
          padding: 11px 28px;
          border-radius: 8px;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          border: none;
          background: var(--cream);
          color: var(--bark);
          transition: transform 0.2s, opacity 0.2s;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
        }

        .lp-btn-light:hover {
          transform: translateY(-1px);
          opacity: 0.9;
        }

        /* FOOTER */
        .lp-footer {
          padding: 1.5rem 2rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 8px;
          border-top: 0.5px solid rgba(44, 31, 20, 0.1);
        }

        .lp-footer-brand {
          font-family: 'Playfair Display', serif;
          font-size: 14px;
          font-weight: 700;
          color: var(--bark);
        }

        .lp-footer p {
          font-size: 11px;
          color: var(--muted);
          font-weight: 300;
        }

        /* ANIMATIONS */
        @keyframes lp-fadeUp {
          from { opacity: 0; transform: translateY(18px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes lp-fadeDown {
          from { opacity: 0; transform: translateY(-12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="lp">
        {/* Navigation */}
        <nav className="lp-nav">
          <Link href="/" className="lp-brand">
            <svg className="lp-brand-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22V12M12 12C12 12 8 10 6 6M12 12C12 12 16 10 18 6M6 6C8 4 10 2 12 2C14 2 16 4 18 6"/>
              <path d="M8 18C9.5 17 11 16.5 12 16.5C13 16.5 14.5 17 16 18"/>
            </svg>
            CeritaKeluarga
          </Link>
          <div className="lp-nav-links">
            <Link href="/auth/login" className="lp-btn-ghost">Masuk</Link>
            <Link href="/auth/register" className="lp-btn-solid">Daftar</Link>
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
            <svg className="lp-hero-tag-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            Khusus Keluarga Muslim Indonesia
          </div>

          <h1 className="lp-hero-h1">
            Satu tempat untuk semua<br />
            <em>cerita keluarga Anda</em>
          </h1>

          <p className="lp-hero-sub">
            Pohon silsilah interaktif, arsip kenangan, dan ruang komunikasi — semuanya dalam platform yang aman dan privat.
          </p>

          <div className="lp-hero-cta">
            <Link href="/auth/register" className="lp-btn-primary">Mulai Gratis</Link>
            <Link href="/auth/login" className="lp-btn-secondary">Masuk ke Akun</Link>
          </div>

          {/* Tree SVG Illustration */}
          <div className="lp-tree-wrap">
            <svg width="220" height="140" viewBox="0 0 220 140" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="105" y="80" width="10" height="50" rx="5" fill="#2C1F14" opacity="0.15" />
              <path d="M110 80 Q90 60 60 50" stroke="#2C1F14" strokeWidth="2.5" strokeLinecap="round" opacity="0.18" fill="none" />
              <path d="M110 80 Q130 55 160 48" stroke="#2C1F14" strokeWidth="2.5" strokeLinecap="round" opacity="0.18" fill="none" />
              <path d="M110 95 Q80 85 50 88" stroke="#2C1F14" strokeWidth="1.5" strokeLinecap="round" opacity="0.12" fill="none" />
              <path d="M110 95 Q140 85 170 88" stroke="#2C1F14" strokeWidth="1.5" strokeLinecap="round" opacity="0.12" fill="none" />
              <circle cx="110" cy="30" r="18" fill="#EAF3DE" />
              <circle cx="110" cy="30" r="18" stroke="#3B6D11" strokeWidth="1.5" opacity="0.4" />
              <text x="110" y="35" textAnchor="middle" fontFamily="Playfair Display" fontSize="10" fill="#3B6D11" fontStyle="italic">Nenek</text>
              <circle cx="55" cy="50" r="14" fill="#FAEEDA" />
              <circle cx="55" cy="50" r="14" stroke="#BA7517" strokeWidth="1.2" opacity="0.4" />
              <text x="55" y="54" textAnchor="middle" fontFamily="DM Sans" fontSize="9" fill="#BA7517">Ayah</text>
              <circle cx="162" cy="48" r="14" fill="#FAEEDA" />
              <circle cx="162" cy="48" r="14" stroke="#BA7517" strokeWidth="1.2" opacity="0.4" />
              <text x="162" y="52" textAnchor="middle" fontFamily="DM Sans" fontSize="9" fill="#BA7517">Ibu</text>
              <circle cx="44" cy="88" r="11" fill="rgba(44,31,20,0.06)" />
              <circle cx="44" cy="88" r="11" stroke="#2C1F14" strokeWidth="1" opacity="0.2" />
              <text x="44" y="92" textAnchor="middle" fontFamily="DM Sans" fontSize="8" fill="#888780">Anda</text>
              <circle cx="170" cy="88" r="11" fill="rgba(44,31,20,0.06)" />
              <circle cx="170" cy="88" r="11" stroke="#2C1F14" strokeWidth="1" opacity="0.2" />
              <text x="170" y="92" textAnchor="middle" fontFamily="DM Sans" fontSize="8" fill="#888780">Adik</text>
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
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M12 22V12M12 12C10 9 7 7 5 5M12 12C14 9 17 7 19 5" />
                </svg>
              </div>
              <h3>Pohon Silsilah</h3>
              <p>Visualisasi interaktif yang bisa di-zoom dan diedit bebas.</p>
            </div>
            <div className="lp-feat-card">
              <div className={`lp-feat-icon lp-feat-icon-gold`}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <h3>Chat Keluarga</h3>
              <p>Ruang komunikasi privat hanya untuk anggota keluarga.</p>
            </div>
            <div className="lp-feat-card">
              <div className={`lp-feat-icon lp-feat-icon-bark`}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 9h6M9 13h6M9 17h4" />
                </svg>
              </div>
              <h3>Arsip Digital</h3>
              <p>Dokumen, foto, dan kenangan tersimpan aman selamanya.</p>
            </div>
            <div className="lp-feat-card">
              <div className={`lp-feat-icon lp-feat-icon-green`}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
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
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <h3>Privasi Ketat</h3>
              <p>Enkripsi penuh, data Anda tidak dibagikan ke siapapun.</p>
            </div>
            <div className="lp-feat-card">
              <div className={`lp-feat-icon lp-feat-icon-bark`}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
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
              Mulai abadikan cerita<br />
              <em>keluarga Anda hari ini</em>
            </h2>
            <p>Gratis selamanya untuk pohon keluarga dasar.</p>
            <Link href="/auth/register" className="lp-btn-light">Buat Akun Gratis</Link>
          </div>
        </div>

        {/* Footer */}
        <footer className="lp-footer">
          <div className="lp-footer-brand">CeritaKeluarga</div>
          <p>2024 CeritaKeluarga. Semua hak dilindungi.</p>
        </footer>
      </div>
    </>
  );
}