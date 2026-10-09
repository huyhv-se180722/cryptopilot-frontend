import { useQuery } from '@tanstack/react-query';
import { useServices } from '../../../hooks/use-services';

/** Ranges the SCR-11 metric charts offer, in days (the API allows 7). */
export const METRIC_RANGES = [1, 3, 7] as const;
export type MetricRange = (typeof METRIC_RANGES)[number];

const DAY_MS = 86_400_000;
/** New points are stored every 5 minutes (NSF-04): never read more often. */
export const METRICS_REFRESH_MS = 300_000;
/**
 * The range ends at the server's now; starting a minute late keeps a
 * 7-day range inside the limit when the device clock runs behind.
 */
const CLOCK_MARGIN_MS = 60_000;

/**
 * Open interest, long/short ratio and settled funding of a Futures pair
 * over the last `days` (SRS 3.3.3, BR-10), read again every 5 minutes.
 */
export function useFuturesMetrics(symbol: string, days: MetricRange) {
  const { market } = useServices();
  return useQuery({
    queryKey: ['futures-metrics', symbol, days],
    queryFn: ({ signal }) =>
      market.getFuturesMetrics(
        symbol,
        new Date(Date.now() - days * DAY_MS + CLOCK_MARGIN_MS).toISOString(),
        signal,
      ),
    staleTime: METRICS_REFRESH_MS,
    refetchInterval: METRICS_REFRESH_MS,
  });
}
