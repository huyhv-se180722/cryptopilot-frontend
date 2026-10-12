import type { WatchlistService } from './contracts';
import { integrationPending } from './errors';
import type { HttpClient } from './http-client';
import { decodeWatchlist, decodeWatchlistItem } from './watchlist-dto';

/** Used while no API base URL is configured. */
export function createPendingWatchlistService(): WatchlistService {
  return {
    get: async () => integrationPending(),
    add: async () => integrationPending(),
    update: async () => integrationPending(),
    remove: async () => integrationPending(),
  };
}

const rowPath = (id: string) => 'watchlist/' + encodeURIComponent(id);
const noContent = () => undefined;

/** `/watchlist/**` with the bearer token (Trader only). */
export function createHttpWatchlistService(http: HttpClient): WatchlistService {
  return {
    get: (signal) =>
      http.request({
        path: 'watchlist',
        decode: decodeWatchlist,
        ...(signal ? { signal } : {}),
      }),
    add: (pairId) =>
      http.request({
        path: 'watchlist',
        method: 'POST',
        body: { pairId },
        decode: decodeWatchlistItem,
      }),
    update: (id, update) =>
      http.request({
        path: rowPath(id),
        method: 'PATCH',
        body: update,
        decode: decodeWatchlistItem,
      }),
    remove: (id, confirmedAlerts) => {
      const query =
        confirmedAlerts === undefined
          ? ''
          : '?' +
            new URLSearchParams({
              confirm: 'true',
              expectedAlertCount: String(confirmedAlerts),
            }).toString();
      return http.request({
        path: rowPath(id) + query,
        method: 'DELETE',
        decode: noContent,
      });
    },
  };
}
