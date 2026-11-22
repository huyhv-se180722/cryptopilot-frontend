import type {
  Candle,
  ChartTimeframe,
  MarketTrade,
} from '../../../types/domain';
import { candleOpen } from '../../../utils/chart-timeframe';
import { add, compare, multiply } from '../../../utils/decimal-math';

export interface TradeCandles {
  /** Candles the trades closed, oldest first, until the next page replaces them. */
  closed: Candle[];
  forming: Candle | null;
}

/** At most this many provisional closed candles are kept (an hour of 1s). */
export const PROVISIONAL_MAX = 3_600;

const open = (trade: MarketTrade, at: number): Candle => ({
  openTime: new Date(at).toISOString(),
  open: trade.price,
  high: trade.price,
  low: trade.price,
  close: trade.price,
  baseVolume: trade.quantity,
  quoteVolume: multiply(trade.price, trade.quantity),
});

/**
 * The trades of the stream folded into the chart's candles, for a
 * timeframe the backend does not stream (TR-35): a trade in the forming
 * candle moves its high, low and close and adds its volume; a trade of a
 * later candle closes the forming one and opens the next at its price, as
 * the exchange builds them. A trade older than the forming candle is
 * dropped (the next page carries it). Exact decimals.
 */
export function foldTrades(
  state: TradeCandles,
  trades: readonly MarketTrade[],
  timeframe: ChartTimeframe,
): TradeCandles {
  let { forming } = state;
  let closed = state.closed;
  for (const trade of trades) {
    const at = candleOpen(Date.parse(trade.time), timeframe);
    const current = forming ? Date.parse(forming.openTime) : null;
    if (current === null || at > current) {
      if (forming) closed = [...closed, forming];
      forming = open(trade, at);
      continue;
    }
    if (at < current || !forming) continue;
    forming = {
      ...forming,
      high: compare(trade.price, forming.high) > 0 ? trade.price : forming.high,
      low: compare(trade.price, forming.low) < 0 ? trade.price : forming.low,
      close: trade.price,
      baseVolume: add(forming.baseVolume, trade.quantity),
      quoteVolume: add(
        forming.quoteVolume,
        multiply(trade.price, trade.quantity),
      ),
    };
  }
  if (closed.length > PROVISIONAL_MAX)
    closed = closed.slice(closed.length - PROVISIONAL_MAX);
  return closed === state.closed && forming === state.forming
    ? state
    : { closed, forming };
}

const opensAt = (candle: Candle) => Date.parse(candle.openTime);

/**
 * The forming candle to draw from the one the trades built (`live`) and the
 * one the page carried (`page`): the later one, or, when both open
 * together, both merged. The trades may have opened theirs before the page
 * arrived, at their first price, so the open is the exchange's; the high
 * and low the widest of the two; the close the trades' (the stream is
 * newer than a cached page); the volume the larger (the trades' when they
 * were folded into the page's candle).
 */
export function newestForming(
  live: Candle | null,
  page: Candle | null,
): Candle | null {
  if (!live) return page;
  if (!page) return live;
  if (opensAt(page) !== opensAt(live))
    return opensAt(page) > opensAt(live) ? page : live;
  const larger = (a: string, b: string) => (compare(a, b) >= 0 ? a : b);
  return {
    openTime: page.openTime,
    open: page.open,
    high: larger(page.high, live.high),
    low: compare(page.low, live.low) <= 0 ? page.low : live.low,
    close: live.close,
    baseVolume: larger(page.baseVolume, live.baseVolume),
    quoteVolume: larger(page.quoteVolume, live.quoteVolume),
  };
}
