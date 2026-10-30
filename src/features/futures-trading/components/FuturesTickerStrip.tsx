import { useEffect, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { Badge } from '../../../components/ui/Badge';
import { NumericText } from '../../../components/ui/NumericText';
import { useCopy } from '../../../hooks/use-copy';
import { formatCopy } from '../../../i18n/copy';
import type { MarketPair, MarketTicker } from '../../../types/domain';
import { classNames } from '../../../utils/class-names';
import { formatCountdown } from '../../../utils/countdown';
import {
  compactDecimal,
  formatPrice,
  fractionToPercent,
  toFixedDecimal,
} from '../../../utils/decimal-format';
import { FreshnessBadge } from '../../market/components/FreshnessBadge';
import type { FeedFreshness } from '../../market/hooks/use-market-tickers';
import { useTickDirection } from '../../paper-trading/hooks/use-tick-direction';

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 xl:shrink-0">
      <dt className="text-[10px] text-muted-dim xl:whitespace-nowrap">
        {label}
      </dt>
      <dd className="text-xs whitespace-nowrap text-fg-2">{children}</dd>
    </div>
  );
}

/**
 * Instrument strip of the Futures screen (plan 12.2): the pair switcher,
 * the last price coloured by its tick, then mark, index, the funding rate
 * with the countdown to the next settlement read from the source (BR-11),
 * and the 24h change, high, low and volume.
 */
export function FuturesTickerStrip({
  pair,
  ticker,
  freshness,
  selector,
}: {
  pair: MarketPair;
  ticker: MarketTicker | null;
  freshness: FeedFreshness;
  selector: ReactNode;
}) {
  const copy = useCopy();
  const f = copy.futures;
  const m = copy.market;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, []);
  const last = ticker?.lastPrice ?? null;
  const direction = useTickDirection(last);
  const Arrow = direction === 'down' ? ArrowDown : ArrowUp;
  const price = (value: string | null | undefined) =>
    value ? (
      <NumericText value={formatPrice(value, pair.tickSize)} />
    ) : (
      m.noValue
    );
  const countdown = formatCountdown(ticker?.nextFundingTime ?? null, now);

  return (
    <section
      aria-label={pair.symbol}
      className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-line bg-surface px-3 py-2"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 max-sm:basis-full">
        {selector}
        <Badge>{f.perpetual}</Badge>
        <Badge tone="warning">{copy.paper.demo}</Badge>
      </div>
      <div className="flex flex-1 items-center gap-3 xl:flex-none">
        <div
          className={classNames(
            'flex shrink-0 items-center gap-1 text-lg font-semibold',
            direction === 'up' && 'text-positive',
            direction === 'down' && 'text-negative',
            direction === null && 'text-fg',
          )}
        >
          <span className="sr-only">{copy.paper.lastPrice}</span>
          {last ? (
            <NumericText value={formatPrice(last, pair.tickSize)} />
          ) : (
            m.noValue
          )}
          {direction && (
            <Arrow
              size={14}
              role="img"
              aria-label={
                direction === 'up' ? copy.paper.priceUp : copy.paper.priceDown
              }
            />
          )}
        </div>
        <span className="ml-auto shrink-0 xl:hidden">
          <FreshnessBadge freshness={freshness} />
        </span>
      </div>
      <div className="flex w-full items-center gap-x-6 xl:w-auto xl:min-w-0 xl:flex-1">
        <dl className="grid flex-1 grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4 md:grid-cols-8 xl:flex xl:flex-none xl:items-center xl:gap-x-6">
          <Stat label={f.mark}>{price(ticker?.markPrice)}</Stat>
          <Stat label={f.index}>{price(ticker?.indexPrice)}</Stat>
          <Stat label={f.fundingCountdown}>
            {ticker?.fundingRate ? (
              <span
                className={classNames(
                  ticker.fundingRate.startsWith('-')
                    ? 'text-negative'
                    : 'text-positive',
                )}
              >
                <NumericText
                  signed
                  value={fractionToPercent(ticker.fundingRate, 4)}
                  suffix="%"
                />
              </span>
            ) : (
              m.noValue
            )}
            {countdown && (
              <span className="ml-1 text-muted">
                / <NumericText value={countdown} />
              </span>
            )}
          </Stat>
          <Stat label={m.colChange}>
            {ticker?.changePercent24h ? (
              <NumericText
                signed
                value={toFixedDecimal(ticker.changePercent24h, 2)}
                suffix="%"
              />
            ) : (
              m.noValue
            )}
          </Stat>
          <Stat label={m.colHigh}>{price(ticker?.high24h)}</Stat>
          <Stat label={m.colLow}>{price(ticker?.low24h)}</Stat>
          <Stat
            label={formatCopy(f.volumeBase24h, { asset: pair.baseAsset ?? '' })}
          >
            {ticker?.baseVolume24h ? (
              <NumericText value={compactDecimal(ticker.baseVolume24h)} />
            ) : (
              m.noValue
            )}
          </Stat>
          <Stat label={f.volume24h}>
            {ticker?.quoteVolume24h ? (
              <NumericText
                value={compactDecimal(ticker.quoteVolume24h)}
                suffix={' ' + (pair.quoteAsset ?? '')}
              />
            ) : (
              m.noValue
            )}
          </Stat>
        </dl>
        <span className="ml-auto hidden shrink-0 xl:inline-flex">
          <FreshnessBadge freshness={freshness} />
        </span>
      </div>
    </section>
  );
}
