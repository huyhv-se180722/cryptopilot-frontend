import {
  useMemo,
  useState,
  type PropsWithChildren,
  type ReactNode,
} from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { ErrorState } from '../../../components/feedback/States';
import { NumericText } from '../../../components/ui/NumericText';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { Skeleton } from '../../../components/ui/Skeleton';
import { useCopy } from '../../../hooks/use-copy';
import { formatCopy } from '../../../i18n/copy';
import { errorText } from '../../../i18n/messages';
import { ServiceError } from '../../../services/api/errors';
import type { Decimal, MarketPair, OrderBook } from '../../../types/domain';
import { classNames } from '../../../utils/class-names';
import {
  decimalPlaces,
  formatPrice,
  groupThousands,
  subtractDecimal,
  toFixedDecimal,
} from '../../../utils/decimal-format';
import type { MarketStream } from '../../market/hooks/use-order-book';
import { useFitRows } from '../hooks/use-fit-rows';
import { useTickDirection } from '../hooks/use-tick-direction';
import {
  formatQuantity,
  groupLevels,
  groupSteps,
  type BookRow,
} from '../model/order-book';
import { LatencyDot } from './LatencyDot';
import { TradePanel } from './TradePanel';

type View = 'both' | 'bids' | 'asks';

/** Levels a side in the depth the backend relays (depth20). */
const DEPTH_LEVELS = 20;
/** Rows a side before the panel is measured: half the book with both sides. */
const ROWS = { both: 12, one: 20 } as const;

/** Share of `part` in `whole`, for bar widths and the B/S ratio (display only). */
const share = (part: Decimal, whole: number) =>
  whole > 0 ? Math.min(100, (Number(part) / whole) * 100) : 0;

/**
 * A row of the book or the trades: a button that hands its price to the
 * order form when there is one (TR-F3), plain text otherwise.
 */
export function PickRow({
  onPick,
  label,
  children,
}: {
  onPick: (() => void) | undefined;
  label: string;
  children: ReactNode;
}) {
  const className =
    'relative grid min-h-5 w-full grid-cols-3 items-center gap-2 px-1 text-[11px]';
  return onPick ? (
    <button
      type="button"
      onClick={onPick}
      aria-label={label}
      className={classNames(className, 'hover:bg-raised-hover')}
    >
      {children}
    </button>
  ) : (
    <div aria-label={label} role="group" className={className}>
      {children}
    </div>
  );
}

function Rows({
  rows,
  side,
  pair,
  step,
  max,
  onPick,
}: {
  rows: readonly BookRow[];
  side: 'bid' | 'ask';
  pair: MarketPair;
  step: Decimal | null;
  max: number;
  onPick?: ((price: Decimal) => void) | undefined;
}) {
  const copy = useCopy();
  const p = copy.paper;
  const places = decimalPlaces(step ?? pair.tickSize);
  // Rows share the height of their half; past what the depth holds they
  // grow a little rather than leave the column empty.
  return (
    <ul
      className={classNames(
        'flex h-full flex-col',
        side === 'ask' && 'justify-end',
      )}
    >
      {rows.map((row) => {
        const price = groupThousands(toFixedDecimal(row.price, places));
        const amount = formatQuantity(row.quantity, pair.stepSize);
        return (
          <li key={row.price} className="relative flex max-h-8 min-h-5 flex-1">
            {/* Depth: the running total against the larger side's total. */}
            <span
              aria-hidden="true"
              className={classNames(
                'absolute inset-y-0 right-0',
                side === 'bid' ? 'bg-positive-soft' : 'bg-negative-soft',
              )}
              style={{ width: `${share(row.cumulative, max)}%` }}
            />
            <PickRow
              onPick={onPick && (() => onPick(row.price))}
              label={formatCopy(side === 'bid' ? p.bidRow : p.askRow, {
                price,
                amount,
              })}
            >
              <NumericText
                value={price}
                className={classNames(
                  'text-left',
                  side === 'bid' ? 'text-positive' : 'text-negative',
                )}
              />
              <NumericText value={amount} className="text-right text-fg-2" />
              <NumericText
                value={formatQuantity(row.cumulative, pair.stepSize)}
                className="text-right text-muted"
              />
            </PickRow>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Order book of the trading screen (B order book, plan section 5): the
 * top levels a side from the exchange's depth20, grouped by a price step,
 * in three views; asks above the last price, bids below, a depth bar per
 * row, the spread and the buy / sell share of the shown amount. Selecting
 * a row hands its price to the order form. These are the exchange's
 * orders: demo orders never appear here.
 */
export function OrderBookPanel({
  pair,
  stream,
  lastPrice,
  onPickPrice,
  className,
}: {
  pair: MarketPair;
  stream: MarketStream<OrderBook | null>;
  lastPrice: Decimal | null;
  onPickPrice?: (price: Decimal) => void;
  className?: string;
}) {
  const copy = useCopy();
  const p = copy.paper;
  const base = pair.baseAsset ?? pair.symbol;
  const quote = pair.quoteAsset ?? '';
  const steps = useMemo(() => groupSteps(pair.tickSize), [pair.tickSize]);
  const [view, setView] = useState<View>('both');
  const [step, setStep] = useState<Decimal | null>(steps[0] ?? null);
  const direction = useTickDirection(lastPrice);
  const Arrow = direction === 'down' ? ArrowDown : ArrowUp;
  const book = stream.value;
  // As many levels as the column has room for, up to the depth held.
  const fit = useFitRows(DEPTH_LEVELS, view === 'both' ? ROWS.both : ROWS.one);
  const count = fit.rows;
  const bids = useMemo(
    () => (book ? groupLevels(book.bids, step, 'bid', count) : []),
    [book, step, count],
  );
  const asks = useMemo(
    () => (book ? groupLevels(book.asks, step, 'ask', count) : []),
    [book, step, count],
  );
  const bidTotal = Number(bids[bids.length - 1]?.cumulative ?? 0);
  const askTotal = Number(asks[asks.length - 1]?.cumulative ?? 0);
  const max = Math.max(bidTotal, askTotal);
  const bestBid = book?.bids[0]?.price;
  const bestAsk = book?.asks[0]?.price;
  const buy = share(String(bidTotal), bidTotal + askTotal);
  const pending =
    stream.error instanceof ServiceError &&
    stream.error.code === 'NOT_CONFIGURED';

  return (
    <TradePanel
      title={p.orderBook}
      className={className}
      actions={
        <>
          <SegmentedControl
            label={p.bookView}
            value={view}
            onChange={setView}
            iconOnly
            options={[
              { value: 'both', label: p.viewBoth, icon: <SidesIcon both /> },
              { value: 'bids', label: p.viewBids, icon: <SidesIcon bids /> },
              { value: 'asks', label: p.viewAsks, icon: <SidesIcon /> },
            ]}
          />
          {steps.length > 1 && (
            <select
              aria-label={p.groupLabel}
              value={step ?? ''}
              onChange={(event) => setStep(event.target.value)}
              className="h-6 rounded border border-line bg-raised px-1 font-mono text-[11px] text-fg-2"
            >
              {steps.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          )}
          <LatencyDot updatedAt={stream.updatedAt} />
        </>
      }
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
      ) : bids.length === 0 && asks.length === 0 ? (
        <p className="flex flex-1 items-center justify-center px-2 py-8 text-center text-xs text-muted-dim">
          {p.bookEmpty}
        </p>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="grid grid-cols-3 gap-2 px-1 pb-1 text-[10px] text-muted-dim">
            <span>{formatCopy(p.colPrice, { asset: quote })}</span>
            <span className="text-right">
              {formatCopy(p.colAmount, { asset: base })}
            </span>
            <span className="text-right">
              {formatCopy(p.colSum, { asset: base })}
            </span>
          </div>
          {view !== 'bids' && (
            <Half measure={fit.measure}>
              {/* Best ask nearest the last price, as on the exchange. */}
              <Rows
                rows={[...asks].reverse()}
                side="ask"
                pair={pair}
                step={step}
                max={max}
                onPick={onPickPrice}
              />
            </Half>
          )}
          <div className="my-1 flex items-baseline justify-between gap-2 border-y border-line px-1 py-1.5">
            <span
              className={classNames(
                'inline-flex items-center gap-1 text-base font-semibold',
                direction === 'up' && 'text-positive',
                direction === 'down' && 'text-negative',
                direction === null && 'text-fg',
              )}
            >
              {lastPrice ? (
                <NumericText value={formatPrice(lastPrice, pair.tickSize)} />
              ) : (
                copy.market.noValue
              )}
              {direction && (
                <Arrow
                  size={13}
                  role="img"
                  aria-label={direction === 'up' ? p.priceUp : p.priceDown}
                />
              )}
            </span>
            {bestBid && bestAsk && (
              <span className="text-[10px] text-muted-dim">
                {p.spread}{' '}
                <NumericText
                  value={formatPrice(
                    subtractDecimal(bestAsk, bestBid),
                    pair.tickSize,
                  )}
                  className="text-fg-2"
                />
              </span>
            )}
          </div>
          {view !== 'asks' && (
            // Both halves are the same height: the asks' measure serves.
            <Half measure={view === 'bids' ? fit.measure : undefined}>
              <Rows
                rows={bids}
                side="bid"
                pair={pair}
                step={step}
                max={max}
                onPick={onPickPrice}
              />
            </Half>
          )}
          {view === 'both' && max > 0 && (
            <div
              role="img"
              aria-label={formatCopy(p.buyShare, {
                buy: buy.toFixed(2),
                sell: (100 - buy).toFixed(2),
              })}
              className="mt-2 flex h-4 items-center gap-1 text-[10px] font-semibold"
            >
              <span className="text-positive">B {buy.toFixed(0)}%</span>
              <span className="flex h-1.5 flex-1 overflow-hidden rounded-full bg-negative-soft">
                <span
                  className="h-full bg-positive"
                  style={{ width: `${buy}%` }}
                />
              </span>
              <span className="text-negative">{(100 - buy).toFixed(0)}% S</span>
            </div>
          )}
        </div>
      )}
    </TradePanel>
  );
}

/** One side's share of the book's height, measured for its row count. */
function Half({
  measure,
  children,
}: PropsWithChildren<{
  measure?: ((element: HTMLElement | null) => void) | undefined;
}>) {
  return (
    <div ref={measure} className="min-h-0 flex-1 overflow-hidden">
      {children}
    </div>
  );
}

/** Small glyph of the three order book views (green bids, red asks). */
function SidesIcon({
  both = false,
  bids = false,
}: {
  both?: boolean;
  bids?: boolean;
}) {
  return (
    <span aria-hidden="true" className="flex h-3 w-3 flex-col gap-px">
      {(both || !bids) && (
        <span
          className={classNames(
            'w-full rounded-[1px] bg-negative',
            both ? 'h-1.5' : 'h-3',
          )}
        />
      )}
      {(both || bids) && (
        <span
          className={classNames(
            'w-full rounded-[1px] bg-positive',
            both ? 'h-1.5' : 'h-3',
          )}
        />
      )}
    </span>
  );
}
