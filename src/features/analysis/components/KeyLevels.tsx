import { NumericText } from '../../../components/ui/NumericText';
import { useCopy } from '../../../hooks/use-copy';
import { formatPrice } from '../../../utils/decimal-format';

/**
 * BR-14 nearest support and resistance of the chart's timeframe, also
 * drawn on the chart. None found is a dash, not a made-up level.
 */
export function KeyLevels({
  support,
  resistance,
  tickSize,
}: {
  support: string | null;
  resistance: string | null;
  tickSize: string | null;
}) {
  const copy = useCopy();
  const a = copy.analysis;
  const value = (level: string | null, tone: string) =>
    level === null ? (
      <span className="text-muted-x">{copy.market.noValue}</span>
    ) : (
      <NumericText value={formatPrice(level, tickSize)} className={tone} />
    );
  return (
    <section
      aria-labelledby="key-levels-title"
      className="rounded-xl border border-line bg-surface p-4"
    >
      <h2
        id="key-levels-title"
        className="mb-2 text-[10px] font-semibold tracking-widest text-muted-x uppercase"
      >
        {a.levelsTitle}
      </h2>
      <dl className="flex flex-col gap-1.5 text-xs">
        <div className="flex justify-between">
          <dt className="text-muted-dim">{a.resistance}</dt>
          <dd>{value(resistance, 'text-negative')}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-dim">{a.support}</dt>
          <dd>{value(support, 'text-positive')}</dd>
        </div>
      </dl>
    </section>
  );
}
