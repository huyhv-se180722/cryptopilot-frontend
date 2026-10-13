import type { MarketPair, MarketType } from '../../types/domain';
import type { MarketFeed, MarketService } from './contracts';
import { integrationPending } from './errors';
import type { HttpClient } from './http-client';
import {
  decodeCandles,
  decodeFuturesMetrics,
  decodeFuturesStats,
  decodePairPage,
  decodeSpotStats,
} from './market-dto';

/** Used while no API base URL is configured. */
export function createPendingMarketService(): MarketService {
  return {
    listPairs: async () => integrationPending(),
    getCandles: async () => integrationPending(),
    getTicker: async () => integrationPending(),
    getFuturesMetrics: async () => integrationPending(),
  };
}

/** Used while no WebSocket URL is configured: never live, so screens show Delayed. */
export const unavailableMarketFeed: MarketFeed = {
  status: () => 'unavailable',
  onStatus: () => () => undefined,
  subscribeOverview: () => () => undefined,
  subscribeTicker: () => () => undefined,
  subscribeKline: () => () => undefined,
};

const PAGE_SIZE = 100;
/** 13–50 pairs today; the bound only stops a runaway loop. */
const MAX_PAGES = 20;
const withSignal = (signal?: AbortSignal) => (signal ? { signal } : {});

/**
 * `/market/**` (public). Calls go without the bearer token: the data is the
 * same for everyone, and an anonymous call neither counts against the
 * account's request budget (ADR-014) nor triggers a token renewal. The
 * pair list has no search or sort parameters, so it is read whole and
 * searched on the client (SRS 3.3.1).
 */
export function createHttpMarketService(http: HttpClient): MarketService {
  return {
    async listPairs(market, signal) {
      const pairs: MarketPair[] = [];
      for (let page = 1; page <= MAX_PAGES; page += 1) {
        const result = await http.request({
          path: `market/pairs?market=${market}&page=${page}&pageSize=${PAGE_SIZE}`,
          decode: decodePairPage,
          anonymous: true,
          ...withSignal(signal),
        });
        pairs.push(...result.items);
        if (result.items.length < PAGE_SIZE || pairs.length >= result.total)
          break;
      }
      return pairs.sort((a, b) => a.displayOrder - b.displayOrder);
    },
    getCandles: ({ market, symbol, timeframe, limit, before, signal }) =>
      http.request({
        path:
          `market/${market}/${encodeURIComponent(symbol)}/candles?tf=${timeframe}&limit=${limit}` +
          (before ? `&to=${encodeURIComponent(before)}` : ''),
        decode: decodeCandles,
        anonymous: true,
        ...withSignal(signal),
      }),
    getTicker: (market: MarketType, symbol, signal) =>
      http.request({
        path: `market/${market}/${encodeURIComponent(symbol)}/stats`,
        decode: market === 'spot' ? decodeSpotStats : decodeFuturesStats,
        anonymous: true,
        ...withSignal(signal),
      }),
    getFuturesMetrics: (symbol, from, signal) =>
      http.request({
        path: `market/futures/${encodeURIComponent(symbol)}/metrics?from=${encodeURIComponent(from)}`,
        decode: decodeFuturesMetrics,
        anonymous: true,
        ...withSignal(signal),
      }),
  };
}
