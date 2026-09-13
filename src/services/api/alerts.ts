import type { AlertsService } from './contracts';
import { integrationPending } from './errors';

/** Replace with a validated HTTP adapter after backend contract approval. */
export function createAlertsService(): AlertsService {
  return { list: async () => integrationPending() };
}
