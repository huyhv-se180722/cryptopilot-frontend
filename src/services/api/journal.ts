import type { JournalService } from './contracts';
import { integrationPending } from './errors';

/** Replace with a validated HTTP adapter after backend contract approval. */
export function createJournalService(): JournalService {
  return { list: async () => integrationPending() };
}
