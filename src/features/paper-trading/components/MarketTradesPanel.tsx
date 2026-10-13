import { ArrowDown, ArrowUp } from 'lucide-react';
import { ErrorState } from '../../../components/feedback/States';
import { NumericText } from '../../../components/ui/NumericText';
import { Skeleton } from '../../../components/ui/Skeleton';
import { useCopy } from '../../../hooks/use-copy';
import { formatCopy } from '../../../i18n/copy';
import { errorText } from '../../../i18n/messages';
import { ServiceError } from '../../../services/api/errors';
import type { Decimal, MarketPair, MarketTrade } from '../../../types/domain';
import { classNames } from '../../../utils/class-names';
import { formatPrice } from '../../../utils/decimal-format';
import type { MarketStream } from '../../market/hooks/use-order-book';
import { formatQuantity } from '../model/order-book';
import { LatencyDot } from './LatencyDot';
import { PickRow } from './OrderBookPanel';
import { TradePanel } from './TradePanel';

const time = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

/**
 * Latest market trades of the trading screen (B market trades, plan
 * section 5): the newest 50 with price, amount and local time. A taker
 * buy is green with an up arrow, a taker sell red with a down arrow.
 * Selecting a row hands its price to the order form.
 */
export function MarketTradesPanel({
  pair,
  stream,
  onPickPrice,
  className,
}: {
  pair: MarketPair;
  stream: MarketStream<readonly MarketTrade[]>;
  onPickPrice?: (price: Decimal) => void;
  className?: string;
}) {
  const copy = useCopy();
  const p = copy.paper;
  const pending =
    stream.error instanceof ServiceError &&
    stream.error.code === 'NOT_CONFIGURED';
  return (
    <TradePanel
      title={p.marketTrades}
      className={className}
      actions={<LatencyDot updatedAt={stream.updatedAt} />}
    >
      {stream.status === 'loading' ? (
        <Skeleton className="h-[480px] w-full" />
      ) : stream.status === 'error' ? (
        pending ? (
          <p className="flex flex-1 items-center justify-center px-2 py-8 text-center text-xs text-muted-dim">
            {errorText(copy, stream.error)}
          </p>
        ) : (
          <ErrorState
            message={errorText(copy, stream.error)}
            onRetry={stream.retry}
          />
        )
      ) : stream.value.length === 0 ? (
        <p className="flex flex-1 items-center justify-center px-2 py-8 text-center text-xs text-muted-dim">
          {p.tradesEmpty}
        </p>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="grid grid-cols-3 gap-2 px-1 pb-1 text-[10px] text-muted-dim">
            <span>
              {formatCopy(p.colPrice, { asset: pair.quoteAsset ?? '' })}
            </span>
            <span className="text-right">
              {formatCopy(p.colAmount, {
                asset: pair.baseAsset ?? pair.symbol,
              })}
            </span>
            <span className="text-right">{p.colTime}</span>
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto">
            {stream.value.map((trade) => {
              const sell = trade.buyerMaker;
              const Arrow = sell ? ArrowDown : ArrowUp;
              const price = formatPrice(trade.price, pair.tickSize);
              return (
                <li key={trade.id}>
                  <PickRow
                    onPick={onPickPrice && (() => onPickPrice(trade.price))}
                    label={`${sell ? p.takerSell : p.takerBuy} ${price}`}
                  >
                    <span
                      className={classNames(
                        'inline-flex items-center gap-0.5',
                        sell ? 'text-negative' : 'text-positive',
                      )}
                    >
                      <NumericText value={price} />
                      <Arrow
                        size={9}
                        role="img"
                        aria-label={sell ? p.takerSell : p.takerBuy}
                      />
                    </span>
                    <NumericText
                      value={formatQuantity(trade.quantity, pair.stepSize)}
                      className="text-right text-fg-2"
                    />
                    <span className="text-right font-mono text-muted tabular-nums">
                      {time.format(new Date(trade.time))}
                    </span>
                  </PickRow>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </TradePanel>
  );
}
