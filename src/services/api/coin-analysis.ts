import type { CoinAnalysisService } from './contracts';
import { integrationPending } from './errors';

/** Replace with a validated HTTP adapter after backend contract approval. */
export function createCoinAnalysisService(): CoinAnalysisService {
  return { get: async () => integrationPending() };
}
