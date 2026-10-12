import { describe, expect, it, vi } from 'vitest';
import type { AlertRule } from '../../types/domain';
import { createHttpAlertsService, createPendingAlertsService } from './alerts';
import { createHttpClient } from './http-client';
import {
  createHttpWatchlistService,
  createPendingWatchlistService,
} from './watchlist';
import { decodeAlert, decodeAlertPage, decodeWatchlist } from './watchlist-dto';

/** Shapes of `/watchlist` and `/alerts` on develop @ 233fcc8. */
const ROW = {
  id: '0199a1b2-7c3d-7e4f-8a9b-0c1d2e3f4a5b',
  pairId: '0199a0f0-1111-7aaa-8bbb-000000000001',
  symbol: 'BTCUSDT',
  spotListed: true,
  futuresListed: true,
  label: 'Majors',
  note: null,
  sortOrder: 0,
  activeAlerts: 2,
  addedAt: '2026-10-01T03:12:44Z',
};

const ALERT = {
  id: '0199a3d4-0000-7000-8000-000000000001',
  watchlistId: ROW.id,
  pairId: ROW.pairId,
  symbol: 'BTCUSDT',
  market: 'SPOT',
  type: 'PRICE',
  indicator: null,
  timeframe: null,
  condition: 'CROSS_ABOVE',
  threshold: '65000.000000000000',
  triggerMode: 'ONCE',
  cooldownMinutes: null,
  notifyInApp: true,
  notifyEmail: false,
  notifyPush: false,
  status: 'ACTIVE',
  triggerCount: 0,
  lastTriggeredAt: null,
  expiresAt: '2026-11-01T00:00:00Z',
  createdAt: '2026-10-02T08:00:00Z',
};

const RULE: AlertRule = {
  market: 'futures',
  type: 'INDICATOR',
  indicator: 'RSI_14',
  timeframe: '4h',
  condition: 'LESS_THAN',
  threshold: '30',
  triggerMode: 'EVERY_TIME',
  cooldownMinutes: 60,
  notifyEmail: true,
  notifyPush: false,
  expiresAt: null,
};

describe('watchlist and alert decoders', () => {
  it('decodes the watchlist with its plan limit', () => {
    const list = decodeWatchlist({ items: [ROW], limit: 5 });
    expect(list.limit).toBe(5);
    expect(list.items[0]).toMatchObject({
      symbol: 'BTCUSDT',
      activeAlerts: 2,
      note: null,
    });
    expect(decodeWatchlist({ items: [], limit: null }).limit).toBeNull();
  });

  it('decodes an alert with the market in lower case', () => {
    const alert = decodeAlert(ALERT);
    expect(alert).toMatchObject({
      market: 'spot',
      indicator: null,
      timeframe: null,
      threshold: '65000.000000000000',
    });
    expect(alert).not.toHaveProperty('notifyInApp');
    expect(
      decodeAlertPage({ items: [ALERT], page: 1, pageSize: 20, total: 1 })
        .items,
    ).toHaveLength(1);
  });

  it('rejects unknown enums and missing flags', () => {
    expect(() => decodeAlert({ ...ALERT, status: 'DONE' })).toThrow();
    expect(() => decodeAlert({ ...ALERT, timeframe: '1m' })).toThrow();
    expect(() =>
      decodeWatchlist({ items: [{ ...ROW, spotListed: undefined }] }),
    ).toThrow();
  });
});

function setup(reply: unknown, status = 200) {
  const calls: {
    url: URL;
    method: string;
    body: unknown;
    auth: string | null;
  }[] = [];
  const http = createHttpClient({
    baseUrl: 'https://api.example.test/api/v1',
    fetcher: vi.fn<typeof fetch>(async (input, init = {}) => {
      calls.push({
        url: new URL(String(input)),
        method: init.method ?? 'GET',
        body: init.body ? JSON.parse(String(init.body)) : undefined,
        auth: new Headers(init.headers).get('Authorization'),
      });
      return status === 204
        ? new Response(null, { status })
        : new Response(JSON.stringify(reply), { status });
    }),
    session: { accessToken: () => 'token-1', refresh: async () => 'renewed' },
  });
  return {
    watchlist: createHttpWatchlistService(http),
    alerts: createHttpAlertsService(http),
    calls,
  };
}

describe('HTTP watchlist adapter', () => {
  it('reads with the bearer token and patches one row', async () => {
    const { watchlist, calls } = setup({ items: [ROW], limit: 5 });
    await watchlist.get();
    expect(calls[0]?.auth).toBe('Bearer token-1');
    const patch = setup(ROW);
    await patch.watchlist.update(ROW.id, { label: '', sortOrder: 3 });
    expect(patch.calls[0]).toMatchObject({
      method: 'PATCH',
      body: { label: '', sortOrder: 3 },
    });
    expect(patch.calls[0]?.url.pathname).toBe('/api/v1/watchlist/' + ROW.id);
  });

  it('asks first, then removes with the confirmed alert count (D-76)', async () => {
    const { watchlist, calls } = setup(undefined, 204);
    await watchlist.remove(ROW.id);
    await watchlist.remove(ROW.id, 3);
    expect(calls[0]?.url.search).toBe('');
    expect(Object.fromEntries(calls[1]?.url.searchParams ?? [])).toEqual({
      confirm: 'true',
      expectedAlertCount: '3',
    });
    expect(calls[1]?.method).toBe('DELETE');
  });

  it('keeps the MSG26 arguments of a refused removal', async () => {
    const { watchlist } = setup(
      {
        status: 400,
        code: 'WATCHLIST_REMOVAL_CONFIRMATION_REQUIRED',
        messageCode: 'MSG26',
        messageArgs: ['BTCUSDT', '3'],
      },
      400,
    );
    await expect(watchlist.remove(ROW.id)).rejects.toMatchObject({
      problem: { messageCode: 'MSG26', messageArgs: ['BTCUSDT', '3'] },
    });
  });

  it('is pending while no API is configured', async () => {
    await expect(createPendingWatchlistService().get()).rejects.toMatchObject({
      code: 'NOT_CONFIGURED',
    });
  });
});

describe('HTTP alerts adapter', () => {
  it('lists with upper-case filters and paging', async () => {
    const { alerts, calls } = setup({
      items: [],
      page: 1,
      pageSize: 20,
      total: 0,
    });
    await alerts.list({
      status: 'PAUSED',
      type: 'PRICE',
      page: 1,
      pageSize: 20,
    });
    expect(Object.fromEntries(calls[0]?.url.searchParams ?? [])).toEqual({
      status: 'PAUSED',
      type: 'PRICE',
      page: '1',
      pageSize: '20',
    });
  });

  it('sends the rule with an upper-case market; the pair only on create', async () => {
    const { alerts, calls } = setup(ALERT);
    await alerts.create(ROW.pairId, RULE);
    await alerts.update(ALERT.id, RULE);
    expect(calls[0]).toMatchObject({
      method: 'POST',
      body: { pairId: ROW.pairId, market: 'FUTURES', timeframe: '4h' },
    });
    expect(calls[1]?.method).toBe('PUT');
    expect(calls[1]?.body).not.toHaveProperty('pairId');
    expect(calls[1]?.url.pathname).toBe('/api/v1/alerts/' + ALERT.id);
  });

  it('pauses, resumes and deletes one alert', async () => {
    const { alerts, calls } = setup(ALERT);
    await alerts.pause(ALERT.id);
    await alerts.resume(ALERT.id);
    const removal = setup(undefined, 204);
    await removal.alerts.remove(ALERT.id);
    expect(calls.map((call) => call.method + ' ' + call.url.pathname)).toEqual([
      'POST /api/v1/alerts/' + ALERT.id + '/pause',
      'POST /api/v1/alerts/' + ALERT.id + '/resume',
    ]);
    expect(removal.calls[0]?.method).toBe('DELETE');
  });

  it('is pending while no API is configured', async () => {
    await expect(
      createPendingAlertsService().list({ page: 1, pageSize: 20 }),
    ).rejects.toMatchObject({ code: 'NOT_CONFIGURED' });
  });
});
