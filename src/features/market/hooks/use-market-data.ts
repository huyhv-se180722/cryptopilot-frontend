import { useQuery } from '@tanstack/react-query';
import { useServices } from '../../../hooks/use-services';
import type { MarketType } from '../../../types/domain';

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
