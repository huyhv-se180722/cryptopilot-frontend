import { useMemo } from 'react';
import type { MarketPair, MarketType } from '../../../types/domain';
import { useMarketPairs } from './use-market-data';
import { useMarketTickers, type MarketTickers } from './use-market-tickers';

export interface MarketBoardData extends MarketTickers {
  market: MarketType;
  pairs: ReturnType<typeof useMarketPairs>;
  /** Every enabled pair, in display order; empty while loading. */
  all: readonly MarketPair[];
}

/**
 * One market's pairs with their live tickers, owned by the page so the
 * table and any side panel read the same prices (polled ones included).
 */
export function useMarketBoard(market: MarketType): MarketBoardData {
  const pairs = useMarketPairs(market);
  const all = useMemo(() => pairs.data ?? [], [pairs.data]);
  const symbols = useMemo(() => all.map((pair) => pair.symbol), [all]);
  return { market, pairs, all, ...useMarketTickers(market, symbols) };
}
