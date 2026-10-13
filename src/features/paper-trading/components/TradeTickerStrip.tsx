import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { Badge } from '../../../components/ui/Badge';
import { NumericText } from '../../../components/ui/NumericText';
import { useCopy } from '../../../hooks/use-copy';
import { formatCopy } from '../../../i18n/copy';
import type { MarketPair, MarketTicker } from '../../../types/domain';
import { classNames } from '../../../utils/class-names';
import {
  compactDecimal,
  formatPrice,
  toFixedDecimal,
} from '../../../utils/decimal-format';
import { FreshnessBadge } from '../../market/components/FreshnessBadge';
import type { FeedFreshness } from '../../market/hooks/use-market-tickers';
import { useTickDirection } from '../hooks/use-tick-direction';

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex shrink-0 flex-col gap-0.5">
      <dt className="text-[10px] whitespace-nowrap text-muted-dim">{label}</dt>
      <dd className="text-xs whitespace-nowrap text-fg-2">{children}</dd>
    </div>
  );
}

/**
 * Instrument strip of the Spot trading screen (B spot header): the pair
 * switcher, last price coloured by its latest tick with an arrow, then the
 * 24h change, high, low and the volume in the base and the quote asset.
 * Values the backend has not sent yet show a dash; nothing is derived.
 * On a narrow screen the statistics wrap below and scroll sideways.
 */
export function TradeTickerStrip({
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
  const p = copy.paper;
  const m = copy.market;
  const last = ticker?.lastPrice ?? null;
  const direction = useTickDirection(last);
  const Arrow = direction === 'down' ? ArrowDown : ArrowUp;
  const price = (value: string | null | undefined) =>
    value ? (
      <NumericText value={formatPrice(value, pair.tickSize)} />
    ) : (
      m.noValue
    );
  const volume = (value: string | null | undefined) =>
    value ? <NumericText value={compactDecimal(value)} /> : m.noValue;

  return (
    <section
      aria-label={pair.symbol}
      className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-line bg-surface px-3 py-2"
    >
      {/* Outside the scroller, so the pair list it opens is not clipped. */}
      <div className="flex shrink-0 items-center gap-2">
        {selector}
        <Badge>{m.spot}</Badge>
        <Badge tone="warning">{p.demo}</Badge>
      </div>
      <div
        className={classNames(
          'flex shrink-0 items-center gap-1 text-lg font-semibold',
          direction === 'up' && 'text-positive',
          direction === 'down' && 'text-negative',
          direction === null && 'text-fg',
        )}
      >
        <span className="sr-only">{p.lastPrice}</span>
        {last ? (
          <NumericText value={formatPrice(last, pair.tickSize)} />
        ) : (
          m.noValue
        )}
        {direction && (
          <Arrow
            size={14}
            role="img"
            aria-label={direction === 'up' ? p.priceUp : p.priceDown}
          />
        )}
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-x-6 overflow-x-auto">
        <dl className="flex items-center gap-x-6">
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
            label={formatCopy(p.volumeIn, {
              asset: pair.baseAsset ?? pair.symbol,
            })}
          >
            {volume(ticker?.baseVolume24h)}
          </Stat>
          <Stat
            label={formatCopy(p.volumeIn, { asset: pair.quoteAsset ?? '' })}
          >
            {volume(ticker?.quoteVolume24h)}
          </Stat>
        </dl>
        <span className="ml-auto shrink-0">
          <FreshnessBadge freshness={freshness} />
        </span>
      </div>
    </section>
  );
}
