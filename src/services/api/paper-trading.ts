import type { PaperTradingService } from './contracts';
import { integrationPending } from './errors';

/**
 * Demo trading stays pending until the backend merges its `paper` module
 * (D-86); there is no HTTP adapter before that, whatever the API base URL.
 */
export function createPendingPaperTradingService(): PaperTradingService {
  return {
    openAccount: async () => integrationPending(),
  };
}
