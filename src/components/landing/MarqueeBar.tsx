/**
 * Marquee Bar — scrolling horizontal infinite
 * Pure CSS animation, no JS dependency
 */

const ITEMS = [
  "Pohon Silsilah",
  "Kenangan Keluarga",
  "Chat Privat",
  "Warisan Islam",
  "Ta'aruf",
  "Keluarga Besar",
  "Kumpul antar keluarga",
];

export function MarqueeBar() {
  // Duplicate items so the loop is seamless
  const doubled = [...ITEMS, ...ITEMS];

  return (
    <div className="ck-marquee-bar" aria-hidden="true">
      <div className="ck-marquee-track">
        {doubled.map((item, i) => (
          <span key={i} className="ck-marquee-item">
            <span className="ck-marquee-dot">·</span>
            {" "}{item}{" "}
          </span>
        ))}
      </div>
    </div>
  );
}
