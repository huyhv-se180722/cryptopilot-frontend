import type { JournalService } from './contracts';
import { integrationPending } from './errors';
import type { HttpClient } from './http-client';
import { decodeJournalPage } from './journal-dto';

/** Used while no API base URL is configured. */
export function createJournalService(): JournalService {
  return { list: async () => integrationPending() };
}

/** `/journal` with the bearer token (Trader only). */
export function createHttpJournalService(http: HttpClient): JournalService {
  return {
    list: ({ status, pairId, page, pageSize }, signal) => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (status) params.set('status', status);
      if (pairId) params.set('pairId', pairId);
      return http.request({
        path: 'journal?' + params.toString(),
        decode: decodeJournalPage,
        ...(signal ? { signal } : {}),
      });
    },
  };
}
