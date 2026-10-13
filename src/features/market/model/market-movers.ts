import type { MarketPair, MarketTicker } from '../../../types/domain';
import { compareDecimal } from '../../../utils/decimal-format';
import { signOf } from '../../../utils/decimal-sign';
import { add } from '../../../utils/decimal-math';

/** A pair with its live ticker, for the home hero. */
export interface PairQuote {
  pair: MarketPair;
  ticker: MarketTicker;
}

/** The hero's pair: BTC/USDT when enabled, else the most traded one. */
export const FEATURED_SYMBOL = 'BTCUSDT';

function quoted(
  pairs: readonly MarketPair[],
  tickers: ReadonlyMap<string, MarketTicker>,
): PairQuote[] {
  return pairs.flatMap((pair) => {
    const ticker = tickers.get(pair.symbol);
    return ticker ? [{ pair, ticker }] : [];
  });
}

/** Most traded first, by 24h quote volume; pairs without one go last. */
export function byVolume(
  pairs: readonly MarketPair[],
  tickers: ReadonlyMap<string, MarketTicker>,
  count: number,
): PairQuote[] {
  return quoted(pairs, tickers)
    .filter((row) => row.ticker.quoteVolume24h !== null)
    .sort((a, b) =>
      compareDecimal(b.ticker.quoteVolume24h!, a.ticker.quoteVolume24h!),
    )
    .slice(0, count);
}

export function featuredPair(
  pairs: readonly MarketPair[],
  tickers: ReadonlyMap<string, MarketTicker>,
): MarketPair | null {
  return (
    pairs.find((pair) => pair.symbol === FEATURED_SYMBOL) ??
    byVolume(pairs, tickers, 1)[0]?.pair ??
    pairs[0] ??
    null
  );
}

/**
 * The largest 24h rises and falls, `count` of each: only pairs that rose
 * are gainers and only pairs that fell are losers, so a calm market can
 * show fewer (never a falling pair among the gainers).
 */
export function topMovers(
  pairs: readonly MarketPair[],
  tickers: ReadonlyMap<string, MarketTicker>,
  count: number,
): { gainers: PairQuote[]; losers: PairQuote[] } {
  const ranked = quoted(pairs, tickers)
    .filter((row) => row.ticker.changePercent24h !== null)
    .sort((a, b) =>
      compareDecimal(b.ticker.changePercent24h!, a.ticker.changePercent24h!),
    );
  const sign = (row: PairQuote) => signOf(row.ticker.changePercent24h!);
  return {
    gainers: ranked.filter((row) => sign(row) === 'positive').slice(0, count),
    losers: ranked
      .filter((row) => sign(row) === 'negative')
      .reverse()
      .slice(0, count),
  };
}

/** How the Spot market moved as a whole over the last 24 hours. */
export interface Breadth {
  rising: number;
  falling: number;
  /** Rising pairs among those that moved, 0–100; null when none moved. */
  risingShare: number | null;
  /** Sum of the pairs' 24h quote volume (a decimal string), or null. */
  volume: string | null;
}

export function breadth(
  pairs: readonly MarketPair[],
  tickers: ReadonlyMap<string, MarketTicker>,
): Breadth {
  let rising = 0;
  let falling = 0;
  let volume: string | null = null;
  for (const { ticker } of quoted(pairs, tickers)) {
    const sign = ticker.changePercent24h
      ? signOf(ticker.changePercent24h)
      : 'zero';
    if (sign === 'positive') rising += 1;
    if (sign === 'negative') falling += 1;
    if (ticker.quoteVolume24h)
      volume = add(volume ?? '0', ticker.quoteVolume24h);
  }
  const moved = rising + falling;
  return {
    rising,
    falling,
    risingShare: moved === 0 ? null : Math.round((rising / moved) * 100),
    volume,
  };
}

/** A mover on the radar, at a place in percent of the radar's box. */
export interface RadarPoint extends PairQuote {
  side: 'rising' | 'falling';
  /** Percent of the box from the left and from the top. */
  x: number;
  y: number;
}

/** The radar's outer ring, as a share of the box from its centre. */
export const RADAR_OUTER = 0.42;
const NEAREST = 0.3;
const FARTHEST = 0.82;

/**
 * Where each mover sits on the radar: rising pairs on the right (60°–150°
 * from north, clockwise) and falling pairs at the upper left (280°–350°),
 * clear of the cards laid over the top-right and bottom-left corners; the
 * bigger its 24h move against the biggest one shown, the farther from the
 * centre.
 */
export function radarPoints(
  gainers: readonly PairQuote[],
  losers: readonly PairQuote[],
): RadarPoint[] {
  const size = (row: PairQuote) =>
    Math.abs(Number(row.ticker.changePercent24h ?? '0'));
  const largest = Math.max(0, ...[...gainers, ...losers].map(size));
  const place = (
    rows: readonly PairQuote[],
    side: RadarPoint['side'],
    from: number,
    to: number,
  ): RadarPoint[] =>
    rows.map((row, i) => {
      const angle =
        ((from + ((to - from) * (i + 0.5)) / rows.length) * Math.PI) / 180;
      const reach =
        RADAR_OUTER *
        (largest === 0
          ? NEAREST
          : NEAREST + (FARTHEST - NEAREST) * (size(row) / largest));
      return {
        ...row,
        side,
        x: 50 + 100 * reach * Math.sin(angle),
        y: 50 - 100 * reach * Math.cos(angle),
      };
    });
  return [
    ...place(gainers, 'rising', 60, 150),
    ...place(losers, 'falling', 280, 350),
  ];
}
