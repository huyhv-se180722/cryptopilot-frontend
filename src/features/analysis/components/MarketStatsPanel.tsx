import type { ReactNode } from 'react';
import { NumericText } from '../../../components/ui/NumericText';
import { useCopy } from '../../../hooks/use-copy';
import type { MarketTicker } from '../../../types/domain';
import {
  compactDecimal,
  formatPrice,
  subtractDecimal,
  toFixedDecimal,
} from '../../../utils/decimal-format';

/**
 * SCR-10 market statistics (SRS 3.3.2): last price, best bid and ask,
 * spread (ask − bid, exact), 24h high, low, change and volume. A value
 * the backend has not reported shows a dash.
 */
export function MarketStatsPanel({
  ticker,
  tickSize,
}: {
  ticker: MarketTicker | null;
  tickSize: string | null;
}) {
  const copy = useCopy();
  const a = copy.analysis;
  const none = <span className="text-muted-x">{copy.market.noValue}</span>;
  const price = (value: string | null | undefined) =>
    value ? <NumericText value={formatPrice(value, tickSize)} /> : none;
  const spread =
    ticker?.bestAsk && ticker.bestBid
      ? subtractDecimal(ticker.bestAsk, ticker.bestBid)
      : null;
  const rows: [string, ReactNode][] = [
    [a.statLast, price(ticker?.lastPrice)],
    [a.statBid, price(ticker?.bestBid)],
    [a.statAsk, price(ticker?.bestAsk)],
    [a.statSpread, price(spread)],
    [a.statHigh, price(ticker?.high24h)],
    [a.statLow, price(ticker?.low24h)],
    [
      a.statChange,
      ticker?.changePercent24h ? (
        <NumericText
          signed
          value={toFixedDecimal(ticker.changePercent24h, 2)}
          suffix="%"
        />
      ) : (
        none
      ),
    ],
    [
      a.statVolume,
      ticker?.quoteVolume24h ? (
        <NumericText value={compactDecimal(ticker.quoteVolume24h)} />
      ) : (
        none
      ),
    ],
  ];
  return (
    <section
      aria-labelledby="market-stats-title"
      className="rounded-xl border border-line bg-surface p-4"
    >
      <h2
        id="market-stats-title"
        className="mb-2 text-[10px] font-semibold tracking-widest text-muted-x uppercase"
      >
        {a.statsTitle}
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
