import { useEffect, useState, type ReactNode } from 'react';
import { NumericText } from '../../../components/ui/NumericText';
import { useCopy } from '../../../hooks/use-copy';
import { formatCopy } from '../../../i18n/copy';
import type { MarketTicker } from '../../../types/domain';
import { formatCountdown } from '../../../utils/countdown';
import { formatPrice, fractionToPercent } from '../../../utils/decimal-format';
import { formatInstantUtc } from '../../../utils/instant-format';

/**
 * SCR-11 mark price, index price, current funding rate and the countdown
 * to the next funding time read from the source, never an assumed 8 hours
 * (SRS 3.3.3, BR-11). The rate is a fraction shown as a signed percent.
 */
export function FuturesPricePanel({
  ticker,
  tickSize,
}: {
  ticker: MarketTicker | null;
  tickSize: string | null;
}) {
  const copy = useCopy();
  const a = copy.analysis;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, []);
  const none = <span className="text-muted-x">{copy.market.noValue}</span>;
  const price = (value: string | null | undefined) =>
    value ? <NumericText value={formatPrice(value, tickSize)} /> : none;
  const next = ticker?.nextFundingTime ?? null;
  const left = formatCountdown(next, now);
  const rows: [string, ReactNode][] = [
    [a.statMark, price(ticker?.markPrice)],
    [a.statIndex, price(ticker?.indexPrice)],
    [
      a.statFunding,
      ticker?.fundingRate ? (
        <NumericText
          signed
          value={fractionToPercent(ticker.fundingRate, 4)}
          suffix="%"
        />
      ) : (
        none
      ),
    ],
    [
      a.statNextFunding,
      left && next ? (
        <span className="flex flex-col">
          <NumericText value={left} />
          <span className="text-[10px] text-muted-dim">
            {formatCopy(a.statNextFundingAt, { time: formatInstantUtc(next) })}
          </span>
        </span>
      ) : (
        none
      ),
    ],
  ];
  return (
    <section
      aria-labelledby="futures-price-title"
      className="rounded-xl border border-line bg-surface p-4"
    >
      <h2
        id="futures-price-title"
        className="mb-2 text-[10px] font-semibold tracking-widest text-muted-x uppercase"
      >
        {a.futuresTitle}
      </h2>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-[10px] text-muted-x">{label}</dt>
            <dd className="text-xs text-fg">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
