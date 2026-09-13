import type { CommunityService } from './contracts';
import { integrationPending } from './errors';

/** Replace with a validated HTTP adapter after backend contract approval. */
export function createCommunityService(): CommunityService {
  return { list: async () => integrationPending() };
}
