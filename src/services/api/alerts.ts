import type { AlertsService } from './contracts';
import { integrationPending } from './errors';
import type { HttpClient } from './http-client';
import { decodeAlert, decodeAlertPage, encodeAlertRule } from './watchlist-dto';

/** Used while no API base URL is configured. */
export function createPendingAlertsService(): AlertsService {
  return {
    list: async () => integrationPending(),
    create: async () => integrationPending(),
    update: async () => integrationPending(),
    remove: async () => integrationPending(),
    pause: async () => integrationPending(),
    resume: async () => integrationPending(),
  };
}

const alertPath = (id: string) => 'alerts/' + encodeURIComponent(id);

/** `/alerts/**` with the bearer token (Trader only); filters in upper case. */
export function createHttpAlertsService(http: HttpClient): AlertsService {
  return {
    list: ({ status, type, page, pageSize }, signal) => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (status) params.set('status', status);
      if (type) params.set('type', type);
      return http.request({
        path: 'alerts?' + params.toString(),
        decode: decodeAlertPage,
        ...(signal ? { signal } : {}),
      });
    },
    create: (pairId, rule) =>
      http.request({
        path: 'alerts',
        method: 'POST',
        body: { pairId, ...encodeAlertRule(rule) },
        decode: decodeAlert,
      }),
    update: (id, rule) =>
      http.request({
        path: alertPath(id),
        method: 'PUT',
        body: encodeAlertRule(rule),
        decode: decodeAlert,
      }),
    remove: (id) =>
      http.request({
        path: alertPath(id),
        method: 'DELETE',
        decode: () => undefined,
      }),
    pause: (id) =>
      http.request({
        path: alertPath(id) + '/pause',
        method: 'POST',
        decode: decodeAlert,
      }),
    resume: (id) =>
      http.request({
        path: alertPath(id) + '/resume',
        method: 'POST',
        decode: decodeAlert,
      }),
  };
}
