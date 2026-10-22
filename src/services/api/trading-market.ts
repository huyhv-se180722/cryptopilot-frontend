import type { StompTopics } from '../websocket/stomp-market-feed';
import type { TradingMarketService } from './contracts';
import { integrationPending } from './errors';
import type { HttpClient } from './http-client';
import { decodeDepth, decodeMarketTrades } from './market-dto';

/**
 * Depth and trades while no API is configured: reads answer NOT_CONFIGURED
 * and no topic is joined.
 */
export function createPendingTradingMarketService(): TradingMarketService {
  return {
    getDepth: async () => integrationPending(),
    getTrades: async () => integrationPending(),
    subscribeDepth: () => () => undefined,
    subscribeTrades: () => () => undefined,
  };
}

const pathOf = (market: string, symbol: string, rest: string) =>
  `market/${market}/${encodeURIComponent(symbol)}/${rest}`;

/**
 * TR-03 over the public market API (no token) and the STOMP connection of
 * the market feed: `/topic/depth.{MARKET}.{SYMBOL}` and
 * `/topic/trades.{MARKET}.{SYMBOL}`. Without a WebSocket URL the topics
 * stay silent and the panels keep the REST snapshot (D-104).
 */
export function createHttpTradingMarketService(
  http: HttpClient,
  topics: StompTopics | null,
): TradingMarketService {
  const topic = (kind: string, market: string, symbol: string) =>
    `/topic/${kind}.${market.toUpperCase()}.${symbol.toUpperCase()}`;
  return {
    getDepth: (market, symbol, signal) =>
      http.request({
        path: pathOf(market, symbol, 'depth'),
        decode: decodeDepth,
        anonymous: true,
        ...(signal ? { signal } : {}),
      }),
    getTrades: (market, symbol, limit, signal) =>
      http.request({
        path: pathOf(market, symbol, `trades?limit=${limit}`),
        decode: decodeMarketTrades,
        anonymous: true,
        ...(signal ? { signal } : {}),
      }),
    subscribeDepth: (market, symbol, listener) =>
      topics?.subscribeTopic(
        topic('depth', market, symbol),
        decodeDepth,
        listener,
      ) ?? (() => undefined),
    subscribeTrades: (market, symbol, listener) =>
      topics?.subscribeTopic(
        topic('trades', market, symbol),
        decodeMarketTrades,
        listener,
      ) ?? (() => undefined),
  };
}
