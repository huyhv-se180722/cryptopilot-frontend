import type { MarketPair, MarketTicker } from '../../../types/domain';
import { compareDecimal } from '../../../utils/decimal-format';
import { signOf } from '../../../utils/decimal-sign';

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
