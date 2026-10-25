import { useQuery } from '@tanstack/react-query';
import { useServices } from '../../../hooks/use-services';
import type { CandleTimeframe, MarketType } from '../../../types/domain';

export type OverviewRange = '1D' | '1W' | '1M' | '6M' | '1Y';

/**
 * Each range of the market overview as closed candles of a stored
 * timeframe (BR-08 keeps 15m, 1h, 4h and 1d): about 100 to 365 points.
 */
export const OVERVIEW_RANGES: Readonly<
  Record<OverviewRange, { timeframe: CandleTimeframe; limit: number }>
> = {
  '1D': { timeframe: '15m', limit: 96 },
  '1W': { timeframe: '1h', limit: 168 },
  '1M': { timeframe: '4h', limit: 180 },
  '6M': { timeframe: '1d', limit: 183 },
  '1Y': { timeframe: '1d', limit: 365 },
};

/** The closed candles of a pair over a range; idle without a symbol. */
export function useOverviewCandles(
  market: MarketType,
  symbol: string | null,
  range: OverviewRange,
) {
  const { market: service } = useServices();
  const { timeframe, limit } = OVERVIEW_RANGES[range];
  return useQuery({
    queryKey: ['market', 'candles', market, symbol, timeframe, limit],
    queryFn: ({ signal }) =>
      service.getCandles({
        market,
        symbol: symbol ?? '',
        timeframe,
        limit,
        signal,
      }),
    enabled: symbol !== null,
    staleTime: 60_000,
  });
}
