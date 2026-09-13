import type { MarketService } from './contracts';
import { integrationPending } from './errors';

/** Replace with a validated HTTP adapter after backend contract approval. */
export function createMarketService(): MarketService {
  return { list: async () => integrationPending() };
}
