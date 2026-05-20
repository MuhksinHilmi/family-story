export const colors = {
  cream: "#F7F3EE",
  bark: "#2C1F14",
  moss: "#3B6D11",
  "moss-light": "#EAF3DE",
  gold: "#BA7517",
  "gold-light": "#FAEEDA",
  muted: "#888780",
} as const;

export const fonts = {
  serif: "'Playfair Display', serif",
  sans: "'DM Sans', sans-serif",
} as const;

export const animations = {
  fadeUp: `@keyframes lp-fadeUp { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }`,
  fadeDown: `@keyframes lp-fadeDown { from { opacity: 0; transform: translateY(-12px); } to { opacity: 1; transform: translateY(0); } }`,
  floatLeaf: `@keyframes lp-floatLeaf { 0% { transform: translateY(0) rotate(0deg); opacity: 0; } 15% { opacity: 0.5; } 85% { opacity: 0.3; } 100% { transform: translateY(-60px) rotate(180deg); opacity: 0; } }`,
} as const;

export const rootStyles = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&display=swap');

:root {
  --cream: ${colors.cream};
  --bark: ${colors.bark};
  --moss: ${colors.moss};
  --moss-light: ${colors["moss-light"]};
  --gold: ${colors.gold};
  --gold-light: ${colors["gold-light"]};
  --muted: ${colors.muted};
}

.lp * { margin: 0; padding: 0; box-sizing: border-box; }
.lp { font-family: ${fonts.sans}; background: var(--cream); color: var(--bark); min-height: 100vh; overflow-x: hidden; }

/* basic svg reset */
.lp svg { display: block; vertical-align: middle; }

/* NAV */
.lp-nav { display: flex; align-items: center; justify-content: space-between; padding: 1.25rem 2rem; background: var(--cream); border-bottom: 0.5px solid rgba(44, 31, 20, 0.12); position: sticky; top: 0; z-index: 50; backdrop-filter: blur(8px); animation: lp-fadeDown 0.6s ease both; }
.lp-brand { display: flex; align-items: center; gap: 8px; font-family: ${fonts.serif}; font-size: 18px; font-weight: 700; color: var(--bark); text-decoration: none; }
.lp-brand-icon { width: 14px; height: 14px; flex-shrink: 0; }

.lp-nav-links { display: flex; gap: 8px; }
.lp-btn-ghost { padding: 7px 16px; border-radius: 6px; font-family: ${fonts.sans}; font-size: 13px; font-weight: 500; cursor: pointer; border: 0.5px solid transparent; background: transparent; color: var(--bark); transition: background 0.2s; text-decoration: none; display: inline-flex; align-items: center; }
.lp-btn-ghost:hover { background: rgba(44, 31, 20, 0.06); }
.lp-btn-solid { padding: 7px 18px; border-radius: 6px; font-family: ${fonts.sans}; font-size: 13px; font-weight: 500; cursor: pointer; border: none; background: var(--bark); color: var(--cream); transition: opacity 0.2s; text-decoration: none; display: inline-flex; align-items: center; }
.lp-btn-solid:hover { opacity: 0.85; }

/* HERO */
.lp-hero { position: relative; padding: 5rem 2rem 3rem; text-align: center; overflow: hidden; }
.lp-hero-bg { position: absolute; inset: 0; pointer-events: none; opacity: 0.06; background-image: radial-gradient(circle at 20% 50%, #3B6D11 0%, transparent 50%), radial-gradient(circle at 80% 30%, #BA7517 0%, transparent 50%); }

/* floating leaves */
.lp-leaf { position: absolute; border-radius: 50% 0 50% 0; opacity: 0; animation: lp-floatLeaf var(--dur, 8s) var(--delay, 0s) ease-in-out infinite; pointer-events: none; }
.lp-leaf:nth-child(1) { top: 10%; left: 15%; background: var(--moss); width: 8px; height: 8px; --dur: 9s; --delay: 0s; }
.lp-leaf:nth-child(2) { top: 25%; left: 75%; background: var(--gold); width: 5px; height: 5px; --dur: 7s; --delay: 1.5s; }
.lp-leaf:nth-child(3) { top: 60%; left: 8%; background: var(--moss); width: 6px; height: 6px; --dur: 10s; --delay: 3s; }
.lp-leaf:nth-child(4) { top: 15%; left: 55%; background: var(--gold); width: 7px; height: 7px; --dur: 8s; --delay: 0.8s; }
.lp-leaf:nth-child(5) { top: 70%; left: 85%; background: var(--moss); width: 5px; height: 5px; --dur: 11s; --delay: 2s; }

.lp-hero-tag { display: inline-flex; align-items: center; gap: 6px; padding: 5px 14px; border-radius: 20px; background: var(--moss-light); color: var(--moss); font-size: 12px; font-weight: 500; letter-spacing: 0.04em; margin-bottom: 1.5rem; animation: lp-fadeUp 0.7s 0.2s ease both; }
.lp-hero-tag-icon { width: 12px; height: 12px; flex-shrink: 0; }

.lp-hero-h1 { font-family: ${fonts.serif}; font-size: clamp(2rem, 5vw, 3.2rem); line-height: 1.2; font-weight: 700; color: var(--bark); margin-bottom: 1.25rem; animation: lp-fadeUp 0.7s 0.35s ease both; }
.lp-hero-h1 em { font-style: italic; color: var(--moss); }
.lp-hero-sub { font-size: 15px; color: var(--muted); font-weight: 300; max-width: 380px; margin: 0 auto 2.5rem; line-height: 1.7; animation: lp-fadeUp 0.7s 0.5s ease both; }
.lp-hero-cta { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; animation: lp-fadeUp 0.7s 0.65s ease both; margin-bottom: 3rem; }

.lp-btn-primary { padding: 11px 26px; border-radius: 8px; font-family: ${fonts.sans}; font-size: 14px; font-weight: 500; cursor: pointer; border: none; background: var(--bark); color: var(--cream); transition: transform 0.2s, opacity 0.2s; text-decoration: none; display: inline-flex; align-items: center; }
.lp-btn-primary:hover { transform: translateY(-1px); opacity: 0.88; }
.lp-btn-secondary { padding: 11px 26px; border-radius: 8px; font-family: ${fonts.sans}; font-size: 14px; font-weight: 500; cursor: pointer; border: 1px solid rgba(44, 31, 20, 0.25); background: transparent; color: var(--bark); transition: background 0.2s, transform 0.2s; text-decoration: none; display: inline-flex; align-items: center; }
.lp-btn-secondary:hover { background: rgba(44, 31, 20, 0.05); transform: translateY(-1px); }

/* TREE ILLUSTRATION */
.lp-tree-wrap { display: flex; justify-content: center; margin: 1.5rem 0 0; animation: lp-fadeUp 0.7s 0.8s ease both; }

/* STATS */
.lp-stats { display: flex; justify-content: center; gap: 2.5rem; flex-wrap: wrap; padding: 1.75rem 2rem; border-top: 0.5px solid rgba(44, 31, 20, 0.1); border-bottom: 0.5px solid rgba(44, 31, 20, 0.1); animation: lp-fadeUp 0.7s 1s ease both; }
.lp-stat { text-align: center; }
.lp-stat-num { font-family: ${fonts.serif}; font-size: 1.8rem; font-weight: 700; color: var(--bark); display: block; }
.lp-stat-label { font-size: 12px; color: var(--muted); font-weight: 300; }

/* FEATURES */
.lp-features { padding: 4rem 2rem; background: #fff; }
.lp-feat-label { text-align: center; font-size: 11px; letter-spacing: 0.1em; font-weight: 500; color: var(--muted); text-transform: uppercase; margin-bottom: 0.75rem; }
.lp-feat-title { font-family: ${fonts.serif}; font-size: clamp(1.5rem, 3vw, 2rem); font-weight: 700; text-align: center; color: var(--bark); margin-bottom: 2.5rem; }
.lp-feat-title em { font-style: italic; color: var(--moss); }
.lp-feat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 1px; border: 1px solid rgba(44, 31, 20, 0.1); border-radius: 12px; overflow: hidden; max-width: 620px; margin: 0 auto; background: rgba(44, 31, 20, 0.1); }
.lp-feat-card { padding: 1.75rem 1.25rem; background: #fff; transition: background 0.25s; cursor: default; }
.lp-feat-card:hover { background: var(--cream); }
.lp-feat-icon { width: 28px; height: 28px; border-radius: 8px; display: flex; align-items: center; justify-content: center; margin-bottom: 0.875rem; flex-shrink: 0; }
.lp-feat-icon svg { width: 12px; height: 12px; }
.lp-feat-icon-green { background: var(--moss-light); color: var(--moss); }
.lp-feat-icon-gold { background: var(--gold-light); color: var(--gold); }
.lp-feat-icon-bark { background: rgba(44, 31, 20, 0.08); color: var(--bark); }
.lp-feat-card h3 { font-size: 13px; font-weight: 500; color: var(--bark); margin-bottom: 4px; }
.lp-feat-card p { font-size: 12px; color: var(--muted); font-weight: 300; line-height: 1.6; }

/* CTA BANNER */
.lp-cta { margin: 3rem 2rem; border-radius: 16px; background: var(--bark); padding: 3.5rem 2rem; text-align: center; position: relative; overflow: hidden; }
.lp-cta::before { content: ''; position: absolute; inset: 0; background: radial-gradient(ellipse at 30% 50%, rgba(59, 109, 17, 0.3) 0%, transparent 60%), radial-gradient(ellipse at 70% 50%, rgba(186, 117, 23, 0.2) 0%, transparent 60%); pointer-events: none; }
.lp-cta-inner { position: relative; z-index: 1; }
.lp-cta h2 { font-family: ${fonts.serif}; font-size: clamp(1.3rem, 3vw, 1.8rem); font-weight: 700; color: var(--cream); margin-bottom: 0.75rem; }
.lp-cta h2 em { font-style: italic; color: #C9E09A; }
.lp-cta p { font-size: 13px; color: rgba(247, 243, 238, 0.6); margin-bottom: 1.75rem; font-weight: 300; }
.lp-btn-light { padding: 11px 28px; border-radius: 8px; font-family: ${fonts.sans}; font-size: 14px; font-weight: 500; cursor: pointer; border: none; background: var(--cream); color: var(--bark); transition: transform 0.2s, opacity 0.2s; text-decoration: none; display: inline-flex; align-items: center; }
.lp-btn-light:hover { transform: translateY(-1px); opacity: 0.9; }

/* FOOTER */
.lp-footer { padding: 1.5rem 2rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; border-top: 0.5px solid rgba(44, 31, 20, 0.1); }
.lp-footer-brand { font-family: ${fonts.serif}; font-size: 14px; font-weight: 700; color: var(--bark); }
.lp-footer p { font-size: 11px; color: var(--muted); font-weight: 300; }

/* ANIMATIONS */
${animations.fadeUp}
${animations.fadeDown}
${animations.floatLeaf}

`;
