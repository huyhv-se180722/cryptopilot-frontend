import type { MarketPair, MarketTicker } from '../../../types/domain';
import {
  compareDecimal,
  decimalPlaces,
  groupThousands,
} from '../../../utils/decimal-format';

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
 * price 24 hours ago is price / (1 + percent / 100). For display only, at
 * the pair's tick precision.
 */
export function absoluteChange(
  price: string,
  percent: string,
  tickSize: string | null,
): string {
  const now = Number(price);
  const change = now - now / (1 + Number(percent) / 100);
  const fixed = Math.abs(change).toFixed(decimalPlaces(tickSize));
  return (change < 0 ? '-' : '+') + groupThousands(fixed);
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
