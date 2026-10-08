import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useServices } from '../../../hooks/use-services';
import type { CandleTimeframe, MarketType } from '../../../types/domain';

/**
 * The backend stores new values about 10 s after a candle closes (NSF-05)
 * and pushes no analysis yet (Q-21): read again a little after that.
 */
export const REFRESH_AFTER_CLOSE_MS = 12_000;

/**
 * Indicators and levels of the chart's timeframe and the setup score of
 * the preset's timeframe (D-53). Read again after a candle of either
 * timeframe closes.
 */
export function usePairAnalysis(
  market: MarketType,
  symbol: string,
  timeframe: CandleTimeframe,
) {
  const { analysis, marketFeed } = useServices();
  const query = useQuery({
    queryKey: ['analysis', market, symbol, timeframe],
    queryFn: ({ signal }) => analysis.get(market, symbol, timeframe, signal),
    staleTime: 30_000,
  });
  const scoreTimeframe = query.data?.setupScore.timeframe;
  const { refetch } = query;

  useEffect(() => {
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const follow = (tf: CandleTimeframe) =>
      marketFeed.subscribeKline(market, symbol, tf, (update) => {
        if (!update.closed) return;
        const timer = setTimeout(() => {
          timers.delete(timer);
          void refetch();
        }, REFRESH_AFTER_CLOSE_MS);
        timers.add(timer);
      });
    const stops = [follow(timeframe)];
    if (scoreTimeframe && scoreTimeframe !== timeframe)
      stops.push(follow(scoreTimeframe));
    return () => {
      stops.forEach((stop) => stop());
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, [market, symbol, timeframe, scoreTimeframe, marketFeed, refetch]);

  return query;
}
