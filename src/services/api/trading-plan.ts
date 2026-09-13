import type { TradingPlanService } from './contracts';
import { integrationPending } from './errors';

/** Replace with a validated HTTP adapter after backend contract approval. */
export function createTradingPlanService(): TradingPlanService {
  return { list: async () => integrationPending() };
}
