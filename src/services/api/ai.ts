import type { AiService } from './contracts';
import { integrationPending } from './errors';

/** Replace with a validated HTTP adapter after backend contract approval. */
export function createAiService(): AiService {
  return { list: async () => integrationPending() };
}
