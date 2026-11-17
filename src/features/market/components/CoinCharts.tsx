import { classNames } from '../../../utils/class-names';

/**
 * A week of hourly closes as a line, green when the week ends higher and
 * red when lower (the CoinMarketCap-style "Last 7 Days" column). The live
 * price, when given, is the last point.
 */
export function Sparkline({
  points,
  latest,
  label,
  className,
}: {
  points: readonly string[];
  latest: string | null;
  label: string;
  className?: string;
}) {
  const values = points.map(Number);
  if (latest) values.push(Number(latest));
  const usable = values.filter((value) => Number.isFinite(value));
  if (usable.length < 2) return <span className="text-muted-x">—</span>;
  const width = 120;
  const height = 36;
  const low = Math.min(...usable);
  const high = Math.max(...usable);
  const span = high - low || 1;
  const path = usable
    .map((value, index) => {
      const x = (index / (usable.length - 1)) * width;
      const y = height - 2 - ((value - low) / span) * (height - 4);
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  const up = (usable.at(-1) ?? 0) >= (usable[0] ?? 0);
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={classNames(
        'h-9 w-30',
        up ? 'text-positive' : 'text-negative',
        className,
      )}
    >
      <path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

const SEGMENTS = [
  'text-negative',
  'text-warning',
  'text-warning opacity-60',
  'text-positive opacity-60',
  'text-positive',
] as const;

/** A point on the gauge's arc for a value 0–100 (0 at the left). */
function onArc(value: number, radius: number, cx: number, cy: number) {
  const angle = Math.PI * (1 - value / 100);
  return { x: cx + radius * Math.cos(angle), y: cy - radius * Math.sin(angle) };
}

/**
 * The Fear & Greed gauge: a half circle in five bands from fear (red) to
 * greed (green) with a marker at the value.
 */
export function FearGreedGauge({
  value,
  label,
  ariaLabel,
}: {
  value: number;
  label: string;
  ariaLabel: string;
}) {
  const cx = 60;
  const cy = 56;
  const radius = 46;
  const marker = onArc(Math.min(100, Math.max(0, value)), radius, cx, cy);
  const tone =
    value < 25
      ? 'bg-negative text-white'
      : value < 45
        ? 'bg-warning text-page'
        : value <= 55
          ? 'bg-raised text-fg'
          : 'bg-positive text-page';
  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className="flex flex-col items-center"
    >
      <svg viewBox="0 0 120 64" className="h-16 w-30" aria-hidden="true">
        {SEGMENTS.map((segment, index) => {
          const from = onArc(index * 20 + 1.5, radius, cx, cy);
          const to = onArc((index + 1) * 20 - 1.5, radius, cx, cy);
          return (
            <path
              key={segment}
              d={`M${from.x.toFixed(2)},${from.y.toFixed(2)} A${radius},${radius} 0 0 1 ${to.x.toFixed(2)},${to.y.toFixed(2)}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="7"
              strokeLinecap="round"
              className={segment}
            />
          );
        })}
        <circle
          cx={marker.x}
          cy={marker.y}
          r="5.5"
          className="fill-fg stroke-page"
          strokeWidth="2"
        />
        <text
          x={cx}
          y={cy - 6}
          textAnchor="middle"
          className="fill-fg text-[22px] font-bold"
        >
          {value}
        </text>
      </svg>
      <span
        className={classNames(
          '-mt-1 rounded px-1.5 py-0.5 text-[10px] font-semibold',
          tone,
        )}
      >
        {label}
      </span>
    </div>
  );
}

/**
 * The hourly change of a series as bars around a middle line, green up
 * and red down (CoinMarketCap draws its liquidations the same way).
 */
export function ChangeBars({
  values,
  label,
}: {
  values: readonly number[];
  label: string;
}) {
  const changes = values.slice(1).map((value, index) => value - values[index]!);
  if (changes.length === 0) return null;
  const width = 240;
  const height = 64;
  const middle = height / 2;
  const largest = Math.max(...changes.map(Math.abs)) || 1;
  const step = width / changes.length;
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="h-16 w-full"
    >
      <line
        x1="0"
        x2={width}
        y1={middle}
        y2={middle}
        stroke="currentColor"
        className="text-line-strong"
        strokeWidth="1"
      />
      {changes.map((change, index) => {
        const size = Math.max(1, (Math.abs(change) / largest) * (middle - 2));
        return (
          <rect
            key={index}
            x={index * step + step * 0.2}
            width={step * 0.6}
            y={change >= 0 ? middle - size : middle}
            height={size}
            rx="1"
            className={change >= 0 ? 'fill-positive' : 'fill-negative'}
          />
        );
      })}
    </svg>
  );
}

/** A bar of the leaning, Bullish (green) against Bearish (red). */
export function SentimentBar({
  share,
  label,
}: {
  share: number | null;
  label: string;
}) {
  return (
    <span className="flex flex-col items-end gap-1">
      <span
        className={classNames(
          'text-[11px] font-semibold',
          share === null
            ? 'text-muted'
            : share >= 0.55
              ? 'text-positive'
              : share <= 0.45
                ? 'text-negative'
                : 'text-muted',
        )}
      >
        {label}
      </span>
      <span
        aria-hidden="true"
        className="flex h-1 w-20 overflow-hidden rounded-full bg-raised"
      >
        {share === null ? (
          <span className="h-full w-full bg-line-strong" />
        ) : (
          <>
            <span
              className="h-full bg-positive"
              style={{ width: `${share * 100}%` }}
            />
            <span
              className="h-full bg-negative"
              style={{ width: `${(1 - share) * 100}%` }}
            />
          </>
        )}
      </span>
    </span>
  );
}
