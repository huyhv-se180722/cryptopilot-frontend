import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCopy } from '../../../hooks/use-copy';
import { useServices } from '../../../hooks/use-services';
import { formatCopy } from '../../../i18n/copy';
import type { Candle, CandleTimeframe } from '../../../types/domain';
import { referenceBars } from '../model/reference-bars';
import {
  ALL_LIVE,
  type FallbackPrices,
  type HealthMarket,
  type MarketHealth,
  type MarketStatus,
} from '../../../services/api/market-status';

export const MARKET_STATUS_KEY = ['market-status'] as const;

/**
 * How often the status is read again whatever the pushes do: a missed push
 * (the socket down, E10) costs at most this long. The backend refuses every
 * trading request while a market is closed, so a late banner never lets a
 * wrong order through.
 */
export const STATUS_POLL_MS = 15_000;

/**
 * The data health of both markets (D-159): read once, kept fresh by the
 * pushes of `/topic/market.status` and a poll. Until the first answer, and
 * when it cannot be read, every market counts as live: the backend is what
 * refuses trading.
 */
export function useMarketStatus(): MarketStatus {
  const { marketStatus } = useServices();
  const client = useQueryClient();
  const query = useQuery({
    queryKey: MARKET_STATUS_KEY,
    queryFn: ({ signal }) => marketStatus.status(signal),
    refetchInterval: STATUS_POLL_MS,
    staleTime: 5_000,
    retry: false,
  });
  useEffect(
    () =>
      marketStatus.subscribe((status) =>
        client.setQueryData(MARKET_STATUS_KEY, status),
      ),
    [marketStatus, client],
  );
  return query.data ?? ALL_LIVE;
}

/** One market's data health. */
export function useMarketHealth(market: HealthMarket): MarketHealth {
  const status = useMarketStatus();
  return (
    status.markets.find((health) => health.market === market) ??
    (ALL_LIVE.markets.find(
      (health) => health.market === market,
    ) as MarketHealth)
  );
}

/**
 * Whether a market's exchange data is lost: paused, or recovering from an
 * incident that lost data; never after a maintenance whose data kept flowing.
 */
export const isLost = (health: MarketHealth) => health.dataLost;

/**
 * Why a pair of a market cannot be traded now (I7), or null: its market is
 * closed, or its own data is lost while the market is open (E5). The order
 * forms show it and stay disabled.
 */
export function useTradingBlock(
  market: HealthMarket,
  symbol: string | null,
): string | null {
  const health = useMarketHealth(market);
  const c = useCopy().marketStatus;
  if (!health.tradingOpen) {
    return formatCopy(c.blocked, {
      market: market === 'SPOT' ? c.spot : c.futures,
    });
  }
  if (symbol && health.pausedPairs.includes(symbol.toUpperCase())) {
    return formatCopy(c.pairBlocked, { symbol: symbol.toUpperCase() });
  }
  return null;
}

/**
 * The display-only reference prices of a market while its data is lost,
 * pushed on `/topic/market.fallback.<MARKET>`; none otherwise.
 */
export function useFallbackPrices(market: HealthMarket): FallbackPrices | null {
  const { marketStatus } = useServices();
  const client = useQueryClient();
  const lost = isLost(useMarketHealth(market));
  const query = useQuery({
    queryKey: [...MARKET_STATUS_KEY, 'fallback', market],
    queryFn: ({ signal }) => marketStatus.fallback(market, signal),
    enabled: lost,
    refetchInterval: lost ? STATUS_POLL_MS : false,
    retry: false,
  });
  useEffect(() => {
    if (!lost) return undefined;
    return marketStatus.subscribeFallback(market, (prices) =>
      client.setQueryData([...MARKET_STATUS_KEY, 'fallback', market], prices),
    );
  }, [marketStatus, client, market, lost]);
  return lost ? (query.data ?? null) : null;
}

/** How many reference minutes the chart reads: five hours. */
const REFERENCE_MINUTES = 300;

/**
 * The display-only reference candles of a pair while its market's data is
 * lost (D-159, Q5), as bars of the chart's timeframe, read again each
 * minute; none otherwise. Drawn apart from the exchange's, never stored.
 */
export function useReferenceBars(
  market: HealthMarket,
  symbol: string,
  timeframe: CandleTimeframe,
): readonly Candle[] {
  const { marketStatus } = useServices();
  const lost = isLost(useMarketHealth(market));
  const query = useQuery({
    queryKey: [...MARKET_STATUS_KEY, 'candles', market, symbol],
    queryFn: ({ signal }) =>
      marketStatus.fallbackCandles(market, symbol, REFERENCE_MINUTES, signal),
    enabled: lost,
    refetchInterval: lost ? 60_000 : false,
    retry: false,
  });
  if (!lost || !query.data) return NO_BARS;
  return referenceBars(query.data, timeframe);
}

const NO_BARS: readonly Candle[] = [];
