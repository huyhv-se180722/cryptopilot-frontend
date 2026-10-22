/** Candles of the decorative silhouette: a fixed walk, not market data. */
const CANDLES = Array.from({ length: 48 }, (_, i) => {
  const at = (n: number) =>
    150 - n * 1.6 + Math.sin(n / 3.1) * 34 + Math.sin(n / 1.3) * 12;
  const open = at(i);
  const close = at(i + 1);
  return {
    x: i * 25 + 6,
    top: Math.min(open, close),
    height: Math.max(3, Math.abs(open - close)),
    high: Math.min(open, close) - 8 - (i % 4) * 3,
    low: Math.max(open, close) + 8 + (i % 3) * 4,
    up: close < open,
  };
});

/** The closes joined, drawn as one line above the candles. */
const TREND = CANDLES.map(
  (c, i) =>
    `${i === 0 ? 'M' : 'L'}${c.x + 6} ${c.up ? c.top : c.top + c.height}`,
).join(' ');

/**
 * Backdrop of the sign-in pages (no Figma frame; design without Figma):
 * a grid that fades from the centre, two soft glows and a faint candle
 * silhouette along the bottom, all from the theme tokens and hidden from
 * assistive technology.
 */
export function AuthBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <div className="absolute inset-0 bg-[linear-gradient(var(--cp-border)_1px,transparent_1px),linear-gradient(90deg,var(--cp-border)_1px,transparent_1px)] bg-size-[44px_44px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_45%,black_10%,transparent_80%)]" />
      <div className="absolute -top-[120px] left-1/2 h-[300px] w-[600px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,var(--cp-primary-bg)_0%,transparent_70%)]" />
      <div className="absolute -right-[160px] bottom-[10%] h-[420px] w-[520px] rounded-full bg-[radial-gradient(ellipse_at_center,var(--cp-accent-bg)_0%,transparent_70%)]" />
      <svg
        viewBox="0 0 1200 300"
        preserveAspectRatio="none"
        className="absolute inset-x-0 bottom-0 h-[34%] w-full opacity-25 [mask-image:linear-gradient(to_top,black_30%,transparent)]"
      >
        {CANDLES.map((c) => (
          <g key={c.x} className={c.up ? 'fill-positive' : 'fill-negative'}>
            <rect x={c.x + 5.5} y={c.high} width={1} height={c.low - c.high} />
            <rect x={c.x} y={c.top} width={12} height={c.height} rx={1} />
          </g>
        ))}
        <path
          d={TREND}
          fill="none"
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
          className="stroke-primary"
        />
      </svg>
    </div>
  );
}
