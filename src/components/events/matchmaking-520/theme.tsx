// Centralized color + visual tokens. Pinks/rose for the romance theme,
// soft green retained as a nod to the hiking identity.
export const m520Theme = {
  gradientHero: "bg-gradient-to-br from-rose-400 via-pink-500 to-orange-400",
  gradientCta:
    "bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700",
  cardAccent: "border-rose-200 bg-rose-50/40",
  cardAccentDark: "dark:border-rose-900/50 dark:bg-rose-950/20",
  stepDotActive: "bg-rose-500",
  stepDotComplete: "bg-rose-400",
  stepDotInactive: "bg-gray-200 dark:bg-gray-700",
  heart: "text-rose-500",
  mountain: "text-emerald-700/70",
};

// Inline SVG: stylized mountain silhouette with a heart at the peak.
// Used in the hero and (smaller) in step headers.
export function HeartMountainIcon({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 48" className={className} aria-hidden="true">
      <path
        d="M2 44 L18 18 L28 32 L40 12 L52 26 L62 44 Z"
        fill="currentColor"
        className="text-emerald-700/80"
      />
      <path
        d="M40 12 c -4 -6 -12 0 -8 6 c 2 3 6 5 8 8 c 2 -3 6 -5 8 -8 c 4 -6 -4 -12 -8 -6 Z"
        fill="currentColor"
        className="text-rose-500"
      />
    </svg>
  );
}
