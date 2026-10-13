import type { TradingMarketService } from './contracts';
import { integrationPending } from './errors';

/**
 * Depth and trades (TR-03) are on the backend branch of demo trading only,
 * not on its develop: reads answer NOT_CONFIGURED and the topics are not
 * joined, whatever the API and WebSocket URLs (D-86).
 */
export function createPendingTradingMarketService(): TradingMarketService {
  return {
    getDepth: async () => integrationPending(),
    getTrades: async () => integrationPending(),
    subscribeDepth: () => () => undefined,
    subscribeTrades: () => () => undefined,
  };
}
