// Design tokens for the 5·20 matchmaking event.
//
// Direction: a quiet, hand-lettered Chinese love letter — dusty rose,
// peach cream, brushed serif headings, drifting plum-blossom petals.
// Avoids the saturated "Valentines pink" cliché.

import "./m520.css";

export const m520Theme = {
  // Atmospheric backgrounds
  pageBg: "bg-[#fdf6ee] dark:bg-[#1a1410]",
  heroGradient:
    "bg-[linear-gradient(135deg,#fde4d3_0%,#f8c6c2_45%,#e89898_100%)] dark:bg-[linear-gradient(135deg,#3a1f1c_0%,#4a2329_50%,#3a1818_100%)]",

  // CTA button — dusty terracotta gradient, not bright pink
  gradientCta:
    "bg-[linear-gradient(135deg,#d4685e_0%,#b85060_100%)] hover:bg-[linear-gradient(135deg,#b85050_0%,#9d4255_100%)] text-[#fdf6ee] shadow-sm",

  // Soft cards with paper feel
  cardAccent:
    "border-[#e8c8c0] bg-[#fdf6ee]/60 dark:border-rose-900/40 dark:bg-rose-950/20",

  // Wizard progress dots
  stepDotActive: "bg-[#d4685e]",
  stepDotComplete: "bg-[#e89898]",
  stepDotInactive: "bg-[#e8d8d0] dark:bg-stone-700",

  // Semantic
  heart: "text-[#d4685e]",
  mountainDeep: "text-[#5a6e57]",
  mountainSoft: "text-[#7a8a6e]",
  ink: "text-[#3a2820] dark:text-[#fdf6ee]",
  inkSoft: "text-[#6a5447] dark:text-[#d4c4b8]",
  goldAccent: "text-[#c89858]",
};

// Headline class — system Chinese serif stack falling back to elegant
// English serif. No web font load.
export const fontDisplayZh = "font-m520-display";

// Refined heart-and-mountains mark. Layered silhouette suggests depth;
// the heart is integrated into the peak rather than parked above it.
export function HeartMountainIcon({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <svg viewBox="0 0 80 60" className={className} aria-hidden="true">
      {/* Far range, faint */}
      <path
        d="M0 54 L14 30 L24 42 L36 24 L48 38 L60 22 L72 36 L80 54 Z"
        fill="currentColor"
        opacity="0.18"
      />
      {/* Mid range */}
      <path
        d="M0 56 L10 38 L22 50 L34 30 L46 44 L60 34 L72 46 L80 56 Z"
        fill="currentColor"
        opacity="0.42"
      />
      {/* Front range with the heart at the tallest peak */}
      <path
        d="M0 58 L12 44 L24 54 L34 36 L46 50 L58 40 L70 52 L80 58 Z"
        fill="currentColor"
      />
      {/* Heart cradled at the highest peak */}
      <g transform="translate(34 26)">
        <path
          d="M0 6 C-4 2 -8 6 -4 10 L0 14 L4 10 C8 6 4 2 0 6 Z"
          fill="#d4685e"
        />
      </g>
      {/* Petal accent floating above */}
      <ellipse
        cx="56"
        cy="10"
        rx="2"
        ry="3"
        fill="#e89898"
        opacity="0.7"
        transform="rotate(-25 56 10)"
      />
    </svg>
  );
}

// A single plum-blossom petal shape — used solo as decoration or as the
// repeating unit in the floating-petals atmosphere.
export function Petal({
  className = "h-3 w-3",
  rotate = 0,
}: {
  className?: string;
  rotate?: number;
}) {
  return (
    <svg
      viewBox="0 0 12 18"
      className={className}
      aria-hidden="true"
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      <path
        d="M6 0 Q11.5 7 6 18 Q0.5 7 6 0 Z"
        fill="currentColor"
      />
    </svg>
  );
}

// Five-petal plum blossom — used as a corner ornament on the homepage
// card and inside the wizard step decorations.
export function PlumBlossom({ className = "h-6 w-6" }: { className?: string }) {
  // Five petals at 72° rotations around the origin.
  const petals = [0, 72, 144, 216, 288];
  return (
    <svg viewBox="-14 -14 28 28" className={className} aria-hidden="true">
      <g fill="currentColor">
        {petals.map((deg) => (
          <ellipse
            key={deg}
            cx="0"
            cy="-7"
            rx="3.5"
            ry="5"
            transform={`rotate(${deg})`}
            opacity="0.85"
          />
        ))}
      </g>
      <circle r="1.6" fill="#c89858" />
    </svg>
  );
}

// Atmospheric layer: drifting petals down the hero. Pure CSS animation,
// only rendered when reduced-motion is not preferred (CSS handles that).
export function FloatingPetals({
  count = 9,
  className = "",
}: {
  count?: number;
  className?: string;
}) {
  const petals = Array.from({ length: count }, (_, i) => {
    const left = (i * 11 + 7) % 100;
    const delay = (i * 1.7) % 12;
    const duration = 10 + ((i * 3) % 8);
    const size = 8 + ((i * 5) % 10);
    const drift = (i % 2 === 0 ? 1 : -1) * (15 + (i % 4) * 8);
    const startRotate = (i * 47) % 360;
    return { i, left, delay, duration, size, drift, startRotate };
  });
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      {petals.map((p) => (
        <span
          key={p.i}
          className="m520-petal absolute -top-4 inline-flex text-rose-300/80 dark:text-rose-200/30"
          style={{
            left: `${p.left}%`,
            width: `${p.size}px`,
            height: `${p.size * 1.5}px`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            // CSS custom properties consumed by the keyframes
            ["--m520-drift" as string]: `${p.drift}px`,
            ["--m520-rotate-start" as string]: `${p.startRotate}deg`,
          }}
        >
          <Petal className="w-full h-full" />
        </span>
      ))}
    </div>
  );
}

// SVG paper grain — overlay on the page to give cards a tactile feel.
// Self-contained data: URL so it ships in the CSS class.
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
