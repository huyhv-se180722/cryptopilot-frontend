import type { AdminService } from './contracts';
import { integrationPending } from './errors';

/** Replace with a validated HTTP adapter after backend contract approval. */
export function createAdminService(): AdminService {
  return { list: async () => integrationPending() };
}
