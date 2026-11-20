import type { MarketPair, MarketTicker } from '../../../types/domain';
import {
  compareDecimal,
  decimalPlaces,
  groupThousands,
  toFixedDecimal,
} from '../../../utils/decimal-format';
import { add, compare, divide, multiply } from '../../../utils/decimal-math';

const PLAIN_SIGNED = /^-?\d+(\.\d+)?$/;

export type OverviewTab = 'spot' | 'futures' | 'gainers' | 'losers';

/** Rows the overview lists, as a news site's market widget does. */
export const OVERVIEW_ROWS = 8;

export interface OverviewRow {
  pair: MarketPair;
  ticker: MarketTicker | undefined;
}

/** The price a row shows: the last trade on Spot, the mark price on Futures. */
export function overviewPrice(row: OverviewRow): string | null {
  const t = row.ticker;
  return (row.pair.market === 'spot' ? t?.lastPrice : t?.markPrice) ?? null;
}

/**
 * The 24-hour change in price, from the price and its percent change: the
 * price 24 hours ago is price / (1 + percent / 100), so the change is
 * price × percent / (100 + percent). Exact decimals (D-102), rounded
 * half-up at the pair's tick precision; null when it cannot be told (a
 * fall of 100 % or more, or a value that is not a decimal).
 */
export function absoluteChange(
  price: string,
  percent: string,
  tickSize: string | null,
): string | null {
  if (!PLAIN_SIGNED.test(price) || !PLAIN_SIGNED.test(percent)) return null;
  const base = add('100', percent);
  if (compare(base, '0') <= 0) return null;
  const change = divide(multiply(price, percent), base);
  const size = toFixedDecimal(
    change.replace(/^-/, ''),
    decimalPlaces(tickSize),
  );
  const negative = change.startsWith('-') && !/^[0.]+$/.test(size);
  return (negative ? '-' : '+') + groupThousands(size);
}

/**
 * Which pairs a tab lists: the first pairs of the market in display order,
 * or the pairs with the largest 24-hour rise or fall.
 */
export function overviewRows(
  tab: OverviewTab,
  pairs: readonly MarketPair[],
  tickers: ReadonlyMap<string, MarketTicker>,
): OverviewRow[] {
  const rows = pairs.map((pair) => ({
    pair,
    ticker: tickers.get(pair.symbol),
  }));
  if (tab === 'spot' || tab === 'futures') return rows.slice(0, OVERVIEW_ROWS);
  const ranked = rows.filter((row) => row.ticker?.changePercent24h != null);
  ranked.sort((a, b) =>
    compareDecimal(b.ticker!.changePercent24h!, a.ticker!.changePercent24h!),
  );
  if (tab === 'losers') ranked.reverse();
  return ranked.slice(0, OVERVIEW_ROWS);
}
