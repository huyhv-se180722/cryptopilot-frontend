import { Activity } from 'lucide-react';
import { useCopy } from '../../../hooks/use-copy';
import { classNames } from '../../../utils/class-names';
import { compactDecimal } from '../../../utils/decimal-format';
import type { Breadth } from '../model/market-movers';

/**
 * SCR-01 hero card at the radar's top right, in place of the prototype's
 * "Risk Engine" card (the numbers of a plan nobody made): how the Spot
 * market moved as a whole in 24 hours, from the live tickers.
 */
export function MarketBreadthCard({
  breadth,
  className,
}: {
  breadth: Breadth;
  className?: string;
}) {
  const copy = useCopy();
  const m = copy.market;
  const rows = [
    {
      label: m.breadthRising,
      value: String(breadth.rising),
      tone: 'text-positive',
    },
    {
      label: m.breadthFalling,
      value: String(breadth.falling),
      tone: 'text-negative',
    },
    {
      label: m.breadthVolume,
      value: breadth.volume
        ? compactDecimal(breadth.volume)
        : copy.market.noValue,
      tone: 'text-primary',
    },
  ];
  return (
    <section
      aria-label={m.breadthTitle}
      className={classNames(
        'rounded-xl border border-line bg-surface/95 p-3 shadow-xl shadow-black/10 backdrop-blur dark:shadow-black/50',
        className,
      )}
    >
      <div className="mb-2.5 flex items-center justify-between">
        <h2 className="font-mono text-[9px] font-semibold tracking-widest text-muted-dim uppercase">
          {m.breadthTitle}
        </h2>
        <Activity size={12} aria-hidden="true" className="text-warning" />
      </div>
      <dl className="flex flex-col gap-1.5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between">
            <dt className="text-[10px] text-muted">{row.label}</dt>
            <dd
              data-numeric
              className={classNames(
                'font-mono text-[11px] font-bold',
                row.tone,
              )}
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
      {breadth.risingShare !== null && (
        <div className="mt-2.5">
          <div className="mb-1 flex items-center justify-between font-mono text-[8px] tracking-wide text-muted-dim uppercase">
            <span>{m.breadthShare}</span>
            <span className="text-fg-2">{breadth.risingShare}%</span>
          </div>
          <div
            role="meter"
            aria-label={m.breadthShare}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={breadth.risingShare}
            className="h-1 overflow-hidden rounded-full bg-negative-soft"
          >
            <div
              className="h-full rounded-full bg-positive transition-[width] duration-700 motion-reduce:transition-none"
              style={{ width: `${breadth.risingShare}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between font-mono text-[8px] uppercase">
            <span className="text-negative">{m.breadthFalling}</span>
            <span className="text-positive">{m.breadthRising}</span>
          </div>
        </div>
      )}
    </section>
  );
}
