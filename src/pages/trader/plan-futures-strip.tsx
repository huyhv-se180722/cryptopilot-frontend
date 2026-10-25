import { useEffect, useState, type ReactNode } from 'react';
import { NumericText } from '../../components/ui/NumericText';
import { useCopy } from '../../hooks/use-copy';
import { useLiveTicker } from '../../features/analysis/hooks/use-live-ticker';
import type { MarketPair } from '../../types/domain';
import { formatCountdown } from '../../utils/countdown';
import { formatPrice, fractionToPercent } from '../../utils/decimal-format';

/**
 * The Futures context of a plan's pair on SCR-17: the mark price the
 * liquidation is measured on, the current funding rate and the countdown
 * to the next funding, as the source reports them (BR-11); "—" until the
 * ticker arrives. The Futures ticker has no last price (M-09); a MARKET
 * entry shows the one it is priced at in the entry section.
 */
export function PlanFuturesStrip({ pair }: { pair: MarketPair }) {
  const copy = useCopy();
  const a = copy.analysis;
  const { ticker } = useLiveTicker('futures', pair.symbol);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, []);
  const none = <span className="text-muted-x">{copy.market.noValue}</span>;
  const price = (value: string | null | undefined) =>
    value ? <NumericText value={formatPrice(value, pair.tickSize)} /> : none;
  const left = formatCountdown(ticker?.nextFundingTime ?? null, now);
  const items: [string, ReactNode][] = [
    [a.statMark, price(ticker?.markPrice)],
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
    [a.statNextFunding, left ? <NumericText value={left} /> : none],
  ];
  return (
    <dl
      aria-label={copy.plan.futuresContext}
      className="grid grid-cols-3 gap-x-4 gap-y-2 rounded-lg border border-line bg-raised px-3 py-2"
    >
      {items.map(([label, value]) => (
        <div key={label}>
          <dt className="text-[10px] text-muted-x">{label}</dt>
          <dd className="text-xs text-fg">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
