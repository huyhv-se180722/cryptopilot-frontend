import type {
  CoinMarketRow,
  CoinSentiment,
  MarketTicker,
} from '../../types/domain';
import {
  compactDecimal,
  groupThousands,
  toFixedDecimal,
} from '../../utils/decimal-format';
import { compare, divide, multiply, subtract } from '../../utils/decimal-math';

/** One row of the coin list: the server's figures with the live ticker. */
export interface CoinView {
  coin: CoinMarketRow;
  /** Live price: the Spot last price, else the Futures mark price. */
  price: string | null;
  change1h: string | null;
  change24h: string | null;
  change7d: string | null;
  marketCap: string | null;
  volume24h: string | null;
  sentiment: CoinSentiment | null;
  /** Where the row leads: the analysis of its Spot pair, else of its Futures pair. */
  href: string | null;
}

/** `(price − then) / then × 100` with two decimals, or null without both. */
export function changePercent(
  price: string | null,
  then: string | null,
): string | null {
  if (!price || !then || compare(then, '0') <= 0) return null;
  return divide(multiply(subtract(price, then), '100'), then, 4, 'half-up');
}

/** A live ticker's price: the last trade on Spot, the mark price on Futures. */
export function livePrice(ticker: MarketTicker | undefined): string | null {
  if (!ticker) return null;
  return ticker.lastPrice ?? ticker.markPrice ?? null;
}

/** One coin with its live tickers and the community's leaning. */
export function coinView(
  coin: CoinMarketRow,
  spot: MarketTicker | undefined,
  futures: MarketTicker | undefined,
  sentiment: CoinSentiment | null,
): CoinView {
  const ticker = spot ?? futures;
  const latest = livePrice(spot) ?? livePrice(futures);
  return {
    coin,
    price: latest,
    change1h: changePercent(latest, coin.price1hAgo),
    change24h: ticker?.changePercent24h ?? null,
    change7d: changePercent(latest, coin.price7dAgo),
    marketCap:
      latest && coin.circulatingSupply
        ? multiply(latest, coin.circulatingSupply)
        : null,
    volume24h: spot?.quoteVolume24h ?? futures?.quoteVolume24h ?? null,
    sentiment,
    href: coin.spotSymbol
      ? `/markets/spot/${coin.spotSymbol}`
      : coin.futuresSymbol
        ? `/markets/futures/${coin.futuresSymbol}`
        : null,
  };
}

/**
 * A US dollar price as the market list writes it: two decimals from $1,
 * four under it, and up to eight significant decimals under one cent.
 */
export function formatUsd(value: string): string {
  const sign = value.startsWith('-') ? '-' : '';
  const absolute = sign ? value.slice(1) : value;
  if (compare(absolute, '1') >= 0)
    return sign + '$' + groupThousands(toFixedDecimal(absolute, 2));
  if (compare(absolute, '0.01') >= 0)
    return sign + '$' + toFixedDecimal(absolute, 4);
  const [, fraction = ''] = toFixedDecimal(absolute, 12).split('.');
  const lead = fraction.search(/[1-9]/);
  const places = lead < 0 ? 2 : Math.min(12, lead + 4);
  return sign + '$' + toFixedDecimal(absolute, places);
}

/** "$1.31T", "$32.08B": a US dollar amount in K / M / B / T. */
export function compactUsd(value: string): string {
  return '$' + compactDecimal(value);
}

/** "20.11M": a coin amount in K / M / B / T. */
export function compactAmount(value: string): string {
  return compactDecimal(value);
}

export type CoinSortKey =
  | 'rank'
  | 'name'
  | 'price'
  | 'change1h'
  | 'change24h'
  | 'change7d'
  | 'marketCap'
  | 'volume24h'
  | 'supply';

export interface CoinSort {
  key: CoinSortKey;
  descending: boolean;
}

const pick: Record<CoinSortKey, (row: CoinView) => string | null> = {
  rank: () => null,
  name: () => null,
  price: (row) => row.price,
  change1h: (row) => row.change1h,
  change24h: (row) => row.change24h,
  change7d: (row) => row.change7d,
  marketCap: (row) => row.marketCap,
  volume24h: (row) => row.volume24h,
  supply: (row) => row.coin.circulatingSupply,
};

/** Rank by market cap: the live market cap, else CoinPaprika's rank. */
function byMarketCap(a: CoinView, b: CoinView): number {
  if (a.marketCap && b.marketCap) return compare(b.marketCap, a.marketCap);
  if (a.marketCap) return -1;
  if (b.marketCap) return 1;
  return (
    (a.coin.rank ?? Number.MAX_SAFE_INTEGER) -
      (b.coin.rank ?? Number.MAX_SAFE_INTEGER) ||
    a.coin.symbol.localeCompare(b.coin.symbol)
  );
}

/** The rows in the order asked; a missing value always sorts last. */
export function sortCoins(
  rows: readonly CoinView[],
  sort: CoinSort,
): CoinView[] {
  const direction = sort.descending ? -1 : 1;
  return [...rows].sort((a, b) => {
    if (sort.key === 'rank') return byMarketCap(a, b) * direction;
    if (sort.key === 'name')
      return a.coin.name.localeCompare(b.coin.name) * direction;
    const x = pick[sort.key](a);
    const y = pick[sort.key](b);
    if (x === null && y === null) return byMarketCap(a, b);
    if (x === null) return 1;
    if (y === null) return -1;
    return compare(x, y) * direction || byMarketCap(a, b);
  });
}

/** The leaning of a coin: share of Bullish among its stances and votes. */
export function bullishShare(sentiment: CoinSentiment | null): number | null {
  if (!sentiment) return null;
  const total = sentiment.bullish + sentiment.bearish;
  return total === 0 ? null : sentiment.bullish / total;
}
