/**
 * The assistant's mark: a robot head holding a coin whose price line goes
 * up. `onColor` is drawn on the primary or a dark fill (white head);
 * `onLight` on a light surface (dark head), which keeps it clear at 28px.
 */
export function AiBotIcon({
  size = 24,
  tone = 'onColor',
  className,
}: {
  size?: number;
  tone?: 'onColor' | 'onLight';
  className?: string;
}) {
  const head = tone === 'onColor' ? '#ffffff' : '#17212f';
  const visor = tone === 'onColor' ? '#17212f' : '#ffffff';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
      className={className}
    >
      <line
        x1="29"
        y1="8"
        x2="29"
        y2="16"
        stroke={head}
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="29" cy="7" r="4" fill="#fbbf24" />
      <rect x="7" y="16" width="44" height="34" rx="11" fill={head} />
      {tone === 'onColor' ? (
        <>
          <rect x="13" y="24" width="32" height="15" rx="7.5" fill={visor} />
          <circle cx="22" cy="31.5" r="3" fill="#22d3ee" />
          <circle cx="36" cy="31.5" r="3" fill="#22d3ee" />
          <rect x="22" y="43" width="14" height="3" rx="1.5" fill="#c4cfde" />
        </>
      ) : (
        <>
          <circle cx="22" cy="31.5" r="4" fill="#22d3ee" />
          <circle cx="36" cy="31.5" r="4" fill="#22d3ee" />
        </>
      )}
      <circle
        cx="49"
        cy="48"
        r="12"
        fill="#fbbf24"
        stroke="#b45309"
        strokeWidth="2.5"
      />
      <path
        d="M42.5 51.5 L46.5 47.5 L49.5 50 L54.5 45"
        fill="none"
        stroke="#7c2d12"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
