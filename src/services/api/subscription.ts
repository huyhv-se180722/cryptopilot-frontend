import type { SubscriptionService } from './contracts';
import { integrationPending } from './errors';

/** Replace with a validated HTTP adapter after backend contract approval. */
export function createSubscriptionService(): SubscriptionService {
  return { list: async () => integrationPending() };
}
