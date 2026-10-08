import type { MarketFeed, MarketService } from './contracts';
import { integrationPending } from './errors';

/** Used while no API base URL is configured. */
export function createPendingMarketService(): MarketService {
  return {
    listPairs: async () => integrationPending(),
    getCandles: async () => integrationPending(),
    getTicker: async () => integrationPending(),
  };
}

/** Used while no WebSocket URL is configured: never live, so screens show Delayed. */
export const unavailableMarketFeed: MarketFeed = {
  status: () => 'unavailable',
  onStatus: () => () => undefined,
  subscribeOverview: () => () => undefined,
};
