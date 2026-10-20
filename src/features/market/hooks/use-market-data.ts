import { useQuery } from '@tanstack/react-query';
import { useServices } from '../../../hooks/use-services';
import type { MarketPair, MarketType } from '../../../types/domain';

/** The list changes only when Admin enables a pair: cache for minutes. */
const PAIRS_STALE_MS = 5 * 60_000;
/** SCR-01 basic chart: the last 90 closed daily candles (SRS 3.3.1). */
export const BASIC_CHART = { timeframe: '1d', limit: 90 } as const;

/** Enabled pairs of a market, in admin display order (BR-07). */
export function useMarketPairs(market: MarketType) {
  const { market: service } = useServices();
  return useQuery({
    queryKey: ['market', 'pairs', market],
    queryFn: ({ signal }) => service.listPairs(market, signal),
    staleTime: PAIRS_STALE_MS,
  });
}

/**
 * A pair with the markets it is listed on, from both market lists (one
 * pair id per symbol, FEQ-01); undefined while either list is unknown.
 */
export function useListedPair(pair: MarketPair):
  | {
      pairId: string;
      symbol: string;
      spotListed: boolean;
      futuresListed: boolean;
    }
  | undefined {
  const spot = useMarketPairs('spot');
  const futures = useMarketPairs('futures');
  if (!spot.data || !futures.data) return undefined;
  const on = (list: readonly MarketPair[]) =>
    list.some((each) => each.symbol === pair.symbol);
  return {
    pairId: pair.pairId,
    symbol: pair.symbol,
    spotListed: on(spot.data),
    futuresListed: on(futures.data),
  };
}

/** Closed daily candles for the basic chart; idle without a symbol. */
export function usePairCandles(market: MarketType, symbol: string | null) {
  const { market: service } = useServices();
  return useQuery({
    queryKey: ['market', 'candles', market, symbol, BASIC_CHART.timeframe],
    queryFn: ({ signal }) =>
      service.getCandles({
        market,
        symbol: symbol ?? '',
        ...BASIC_CHART,
        signal,
      }),
    enabled: symbol !== null,
    staleTime: 60_000,
  });
}
