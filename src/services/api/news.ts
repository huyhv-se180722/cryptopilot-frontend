import type { NewsService } from './contracts';
import { integrationPending } from './errors';

/** Replace with a validated HTTP adapter after backend contract approval. */
export function createNewsService(): NewsService {
  return { list: async () => integrationPending() };
}
