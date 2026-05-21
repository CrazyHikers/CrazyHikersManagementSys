// Design tokens for the 5·20 audience-team event.
//
// Direction: an evening lantern pavilion — onlookers gathered at dusk
// to witness the matchmaking unfold. Same paper-cream world as
// matchmaking_520 (the two run at one venue), but cool celadon and
// warm lantern-gold replace the dusty-rose palette so audience members
// feel they have their own identity.
//
// Visual pairing:
//   matchmaking_520 = warm terracotta, plum blossom, falling petals
//   audience_520    = cool celadon + lantern gold, hanging lanterns,
//                     drifting fireflies

import "./audience520.css";

export const aud520Theme = {
  // Shared paper background — both teams live in the same world.
  pageBg: "bg-[#fdf6ee] dark:bg-[#141a18]",

  // Twilight gradient: warm lantern glow drifting into dusk-blue.
  heroGradient:
    "bg-[linear-gradient(135deg,#fde4a3_0%,#f0a868_45%,#5a8a6e_100%)] dark:bg-[linear-gradient(135deg,#3a2818_0%,#3a3a2a_50%,#1c2a24_100%)]",

  // Primary CTA: deep celadon — distinct from matchmaking's terracotta
  // CTA, complementary in palette.
  gradientCta:
    "bg-[linear-gradient(135deg,#5a8a6e_0%,#3f6a52_100%)] hover:bg-[linear-gradient(135deg,#4a7a5e_0%,#345a44_100%)] text-[#fdf6ee] shadow-sm",

  // Cards: cooler border tone than matchmaking, same paper feel.
  cardAccent:
    "border-[#c8d4c4] bg-[#fdf6ee]/60 dark:border-emerald-900/40 dark:bg-emerald-950/20",

  // Wizard-style dots (used on landing flow markers).
  stepDotActive: "bg-[#5a8a6e]",
  stepDotComplete: "bg-[#a8c0a0]",
  stepDotInactive: "bg-[#d8e0d4] dark:bg-stone-700",

  // Semantic
  lantern: "text-[#c84840]",
  lanternGlow: "text-[#e8a850]",
  jadeDeep: "text-[#3f6a52]",
  jadeSoft: "text-[#5a8a6e]",
  ink: "text-[#2a3a32] dark:text-[#fdf6ee]",
  inkSoft: "text-[#5a6a5e] dark:text-[#c8d4c4]",
  goldAccent: "text-[#c89858]",
};

// Display headline class. Distinct from matchmaking's class so we can
// retune later, but stack falls back to the same Chinese serif family.
export const fontDisplayAud = "font-aud520-display";

// Pavilion-and-lantern mark. A tea-pavilion silhouette with a hanging
// red lantern — reads as "audience standing at the eaves, watching".
export function PavilionLanternIcon({
  className = "h-10 w-10",
}: {
  className?: string;
}) {
  return (
    <svg viewBox="0 0 80 64" className={className} aria-hidden="true">
      {/* Distant mountain (echoes matchmaking's mountain mark) */}
      <path
        d="M0 56 L20 38 L34 50 L48 30 L60 44 L80 56 Z"
        fill="currentColor"
        opacity="0.22"
      />
      {/* Pavilion roof — curved Chinese eaves */}
      <path
        d="M14 24 Q40 8 66 24 L62 26 Q40 14 18 26 Z"
        fill="currentColor"
      />
      {/* Roof ridge ornaments */}
      <circle cx="14" cy="24" r="1.8" fill="currentColor" />
      <circle cx="66" cy="24" r="1.8" fill="currentColor" />
      {/* Pavilion columns */}
      <rect x="22" y="26" width="2.5" height="22" fill="currentColor" />
      <rect x="55.5" y="26" width="2.5" height="22" fill="currentColor" />
      {/* Pavilion floor */}
      <rect x="18" y="48" width="44" height="2.5" fill="currentColor" />
      {/* Hanging lantern — red, glowing */}
      <line
        x1="40"
        y1="26"
        x2="40"
        y2="32"
        stroke="currentColor"
        strokeWidth="0.8"
      />
      <ellipse cx="40" cy="38" rx="6" ry="7" fill="#c84840" />
      <ellipse cx="40" cy="38" rx="6" ry="7" fill="none" stroke="#8a2828" strokeWidth="0.5" />
      <rect x="37.5" y="30" width="5" height="1.5" fill="#c89858" />
      <rect x="37.5" y="45" width="5" height="1.5" fill="#c89858" />
      {/* Tassel */}
      <line x1="40" y1="46.5" x2="40" y2="50" stroke="#c89858" strokeWidth="0.6" />
      <circle cx="40" cy="50.8" r="0.9" fill="#c89858" />
    </svg>
  );
}

// Single hanging lantern — used as a corner ornament. The string lets
// it sit naturally below where it's anchored.
export function HangingLantern({
  className = "h-8 w-6",
  swayClass = "",
}: {
  className?: string;
  swayClass?: string;
}) {
  return (
    <span className={`inline-block ${className}`} aria-hidden="true">
      <span className={`block ${swayClass}`}>
        <svg viewBox="0 0 24 36" className="w-full h-full">
          {/* String */}
          <line
            x1="12"
            y1="0"
            x2="12"
            y2="8"
            stroke="#8a6a4a"
            strokeWidth="0.6"
          />
          {/* Top cap */}
          <rect x="8" y="8" width="8" height="2" fill="#c89858" />
          {/* Lantern body */}
          <ellipse cx="12" cy="18" rx="8" ry="9" fill="#c84840" />
          <ellipse
            cx="12"
            cy="18"
            rx="8"
            ry="9"
            fill="none"
            stroke="#8a2828"
            strokeWidth="0.6"
          />
          {/* Vertical rib for paper feel */}
          <ellipse
            cx="12"
            cy="18"
            rx="3"
            ry="9"
            fill="none"
            stroke="#8a2828"
            strokeWidth="0.4"
            opacity="0.6"
          />
          {/* Bottom cap */}
          <rect x="8" y="26" width="8" height="2" fill="#c89858" />
          {/* Tassel */}
          <line
            x1="12"
            y1="28"
            x2="12"
            y2="33"
            stroke="#c89858"
            strokeWidth="0.7"
          />
          <circle cx="12" cy="34" r="1.2" fill="#c89858" />
        </svg>
      </span>
    </span>
  );
}

// A tiny firefly glyph — a soft golden dot. Pure SVG so we can recolor
// via currentColor. Used for the atmospheric layer.
export function Firefly({ className = "h-2 w-2" }: { className?: string }) {
  return (
    <svg viewBox="0 0 8 8" className={className} aria-hidden="true">
      <circle cx="4" cy="4" r="2" fill="currentColor" opacity="0.9" />
      <circle cx="4" cy="4" r="3.5" fill="currentColor" opacity="0.25" />
    </svg>
  );
}

// Atmospheric layer: drifting fireflies rising up the hero. Mirrors
// the FloatingPetals component from matchmaking_520 but flipped in
// direction and motif.
export function FloatingFireflies({
  count = 12,
  className = "",
}: {
  count?: number;
  className?: string;
}) {
  const flies = Array.from({ length: count }, (_, i) => {
    const left = (i * 13 + 5) % 100;
    const delay = (i * 1.3) % 14;
    const duration = 12 + ((i * 3) % 10);
    const size = 4 + ((i * 3) % 6);
    const drift = (i % 2 === 0 ? 1 : -1) * (20 + (i % 4) * 10);
    return { i, left, delay, duration, size, drift };
  });
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      {flies.map((f) => (
        <span
          key={f.i}
          className="aud520-firefly absolute inline-flex text-[#f5d97a] dark:text-[#e8a850]"
          style={{
            left: `${f.left}%`,
            bottom: 0,
            width: `${f.size}px`,
            height: `${f.size}px`,
            ["--aud520-rise-delay" as string]: `${f.delay}s`,
            ["--aud520-rise-duration" as string]: `${f.duration}s`,
            ["--aud520-drift" as string]: `${f.drift}px`,
          }}
        >
          <Firefly className="w-full h-full" />
        </span>
      ))}
    </div>
  );
}

// SVG paper grain — overlay on the page to give cards a tactile feel.
// Mirrors the matchmaking_520 PaperGrain so the two pages share their
// physical substrate.
export function PaperGrain({
  className = "",
  opacity = 0.06,
}: {
  className?: string;
  opacity?: number;
}) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 ${className}`}
      style={{
        opacity,
        backgroundImage:
          'url("data:image/svg+xml;utf8,<svg xmlns=\\"http://www.w3.org/2000/svg\\" width=\\"160\\" height=\\"160\\"><filter id=\\"n\\"><feTurbulence type=\\"fractalNoise\\" baseFrequency=\\"0.92\\" numOctaves=\\"2\\" stitchTiles=\\"stitch\\"/><feColorMatrix values=\\"0 0 0 0 0.18  0 0 0 0 0.13  0 0 0 0 0.1  0 0 0 0.9 0\\"/></filter><rect width=\\"100%\\" height=\\"100%\\" filter=\\"url(%23n)\\"/></svg>")',
        mixBlendMode: "multiply",
      }}
    />
  );
}

// A lantern garland used as a decorative strip below the hero — a row
// of small hanging lanterns swaying gently in offset rhythm.
export function LanternGarland({
  count = 7,
  className = "",
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none flex justify-around items-start ${className}`}
    >
      {Array.from({ length: count }).map((_, i) => (
        <HangingLantern
          key={i}
          className="h-10 w-7"
          swayClass={i % 2 === 0 ? "aud520-sway" : "aud520-sway-slow"}
        />
      ))}
    </div>
  );
}
