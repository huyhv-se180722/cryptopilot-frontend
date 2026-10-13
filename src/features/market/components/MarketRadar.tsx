import { useId } from 'react';
import { useCopy } from '../../../hooks/use-copy';
import { formatCopy } from '../../../i18n/copy';
import type { MarketPair } from '../../../types/domain';
import { classNames } from '../../../utils/class-names';
import { toFixedDecimal } from '../../../utils/decimal-format';
import { withSign } from '../../../utils/decimal-sign';
import { RADAR_OUTER, type RadarPoint } from '../model/market-movers';

/** The radar's view box: 400 × 400 with the centre at 200, 200. */
const BOX = 400;
const C = BOX / 2;
const R = BOX * RADAR_OUTER;
const RINGS = [0.25, 0.5, 0.75, 1] as const;
const SPOKES = Array.from({ length: 8 }, (_, i) => (i * Math.PI) / 4);
/** The beam: a 60° wedge from north, turning round the centre. */
const BEAM = `M${C},${C} L${C},${C - R} A${R},${R} 0 0,1 ${(
  C +
  R * Math.cos(-Math.PI / 6)
).toFixed(1)},${(C + R * Math.sin(-Math.PI / 6)).toFixed(1)} Z`;

/**
 * SCR-01 hero radar, the prototype's "AI Market Radar" drawn from live
 * data: each point is one of the day's biggest moves among the Spot
 * pairs, rising on the right and falling at the upper left, farther from
 * the centre for a bigger move, labelled with its 24h change (the
 * prototype labelled invented events). The rings, spokes and turning beam
 * are decoration; each point is a button that opens the pair's chart.
 */
export function MarketRadar({
  points,
  onSelect,
}: {
  points: readonly RadarPoint[];
  onSelect: (pair: MarketPair) => void;
}) {
  const copy = useCopy();
  const m = copy.market;
  const id = useId();
  const beam = `${id}-beam`;
  const hub = `${id}-hub`;

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[480px]">
      <svg
        viewBox={`0 0 ${BOX} ${BOX}`}
        aria-hidden="true"
        className="absolute inset-0 size-full overflow-visible"
      >
        <defs>
          <radialGradient id={beam} cx="50%" cy="50%" r="50%">
            <stop
              offset="0%"
              style={{ stopColor: 'var(--cp-primary)' }}
              stopOpacity="0"
            />
            <stop
              offset="60%"
              style={{ stopColor: 'var(--cp-primary)' }}
              stopOpacity="0.18"
            />
            <stop
              offset="100%"
              style={{ stopColor: 'var(--cp-primary)' }}
              stopOpacity="0.04"
            />
          </radialGradient>
          <radialGradient id={hub} cx="50%" cy="50%" r="50%">
            <stop
              offset="0%"
              style={{ stopColor: 'var(--cp-primary)' }}
              stopOpacity="0.22"
            />
            <stop
              offset="100%"
              style={{ stopColor: 'var(--cp-primary)' }}
              stopOpacity="0"
            />
          </radialGradient>
        </defs>
        <g className="text-line-strong">
          {RINGS.map((ring, i) => (
            <circle
              key={ring}
              cx={C}
              cy={C}
              r={ring * R}
              fill="none"
              stroke="currentColor"
              strokeWidth={i === 3 ? 1.2 : 0.7}
              strokeDasharray={i < 2 ? '3 9' : i === 2 ? '3 6' : undefined}
            />
          ))}
          {SPOKES.map((angle) => (
            <line
              key={angle}
              x1={C}
              y1={C}
              x2={C + R * Math.sin(angle)}
              y2={C - R * Math.cos(angle)}
              stroke="currentColor"
              strokeWidth="0.7"
            />
          ))}
        </g>
        {points.map((point) => (
          <line
            key={point.pair.symbol}
            x1={C}
            y1={C}
            x2={(point.x / 100) * BOX}
            y2={(point.y / 100) * BOX}
            className={
              point.side === 'rising' ? 'text-positive' : 'text-negative'
            }
            stroke="currentColor"
            strokeWidth="0.6"
            strokeOpacity="0.35"
            strokeDasharray="2 6"
          />
        ))}
        <g className="radar-sweep">
          <path d={BEAM} fill={`url(#${beam})`} />
          <line
            x1={C}
            y1={C}
            x2={C}
            y2={C - R}
            className="text-primary"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeOpacity="0.65"
          />
        </g>
        <circle cx={C} cy={C} r={26} fill={`url(#${hub})`} />
        <circle
          cx={C}
          cy={C}
          r={17}
          className="fill-surface text-line-strong"
          stroke="currentColor"
        />
        <text
          x={C}
          y={C - 3}
          textAnchor="middle"
          className="fill-muted font-mono"
          fontSize="6.5"
          letterSpacing="1.5"
        >
          {m.radarCenterTop}
        </text>
        <text
          x={C}
          y={C + 7}
          textAnchor="middle"
          className="fill-primary font-mono"
          fontSize="6"
          letterSpacing="1"
        >
          {m.radarCenterBottom}
        </text>
      </svg>

      {points.map((point) => {
        const change = toFixedDecimal(point.ticker.changePercent24h ?? '0', 2);
        const rising = point.side === 'rising';
        const name = `${point.pair.baseAsset ?? point.pair.symbol}/${point.pair.quoteAsset ?? ''}`;
        return (
          <button
            key={point.pair.symbol}
            type="button"
            aria-label={formatCopy(m.radarNode, {
              pair: name,
              change: withSign(change),
            })}
            onClick={() => onSelect(point.pair)}
            style={{ left: `${point.x}%`, top: `${point.y}%` }}
            className={classNames(
              'group absolute flex -translate-y-1/2 items-center gap-1.5 rounded-md transition-[left,top] duration-700 motion-reduce:transition-none',
              rising
                ? '-translate-x-[7px]'
                : '-translate-x-[calc(100%-7px)] flex-row-reverse',
            )}
          >
            <span className="relative flex size-3.5 items-center justify-center">
              <span
                aria-hidden="true"
                className={classNames(
                  'radar-ping absolute inset-0 rounded-full border',
                  rising ? 'border-positive' : 'border-negative',
                )}
              />
              <span
                aria-hidden="true"
                className={classNames(
                  'size-2 rounded-full ring-4 group-hover:ring-6',
                  rising
                    ? 'bg-positive ring-positive-soft'
                    : 'bg-negative ring-negative-soft',
                )}
              />
            </span>
            <span
              aria-hidden="true"
              className={classNames(
                'flex flex-col leading-tight',
                rising ? 'items-start' : 'items-end',
              )}
            >
              <span
                className={classNames(
                  'text-[11px] font-bold group-hover:underline',
                  rising ? 'text-positive' : 'text-negative',
                )}
              >
                {point.pair.baseAsset ?? point.pair.symbol}
              </span>
              <span className="font-mono text-[10px] text-muted">
                {withSign(change)}%
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
