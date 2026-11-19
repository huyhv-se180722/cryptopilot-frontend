import { describe, expect, it, vi } from 'vitest';
import { createHttpClient } from './http-client';
import {
  ALL_LIVE,
  createHttpMarketStatusService,
  createPendingMarketStatusService,
  decodeFallbackPrices,
  decodeMarketHealth,
  decodeMarketIncident,
} from './market-status';

/** `MarketHealthResponse` of a paused Futures market, backend feat/market-outage-pause. */
const PAUSED = {
  market: 'FUTURES',
  state: 'PAUSED',
  tradingOpen: false,
  since: '2026-11-19T07:32:05Z',
  pausedAt: '2026-11-19T07:32:35Z',
  reason: 'IP_BANNED',
  message: null,
  incidentId: '019b0000-0000-7000-8000-000000000001',
  resumedAt: null,
  pausedPairs: [],
  expectedEndAt: null,
  retryAt: '2026-11-19T07:40:00Z',
  recovery: null,
  displaySource: 'OKX',
};

function setup(answer: (url: URL, init: RequestInit) => unknown) {
  const calls: { url: URL; init: RequestInit }[] = [];
  const http = createHttpClient({
    baseUrl: 'https://api.example.test/api/v1',
    fetcher: vi.fn<typeof fetch>(async (input, init = {}) => {
      const url = new URL(String(input));
      calls.push({ url, init });
      return new Response(JSON.stringify(answer(url, init)), { status: 200 });
    }),
    session: { accessToken: () => 'token-1', refresh: async () => 'renewed' },
  });
  return { calls, service: createHttpMarketStatusService(http) };
}

describe('market status decoders', () => {
  it('reads a paused market with its retry time and source', () => {
    expect(decodeMarketHealth(PAUSED)).toEqual(PAUSED);
  });

  it('reads a recovering market with its progress, and the lost pairs of an open one', () => {
    expect(
      decodeMarketHealth({
        ...PAUSED,
        state: 'RECOVERING',
        recovery: { pairsDone: 3, pairsTotal: 5 },
      }).recovery,
    ).toEqual({ pairsDone: 3, pairsTotal: 5 });
    const open = decodeMarketHealth({
      market: 'SPOT',
      state: 'LIVE',
      tradingOpen: true,
      pausedPairs: ['BTCUSDT'],
    });
    expect(open.pausedPairs).toEqual(['BTCUSDT']);
    expect(open.displaySource).toBe('BINANCE');
  });

  it('rejects an unknown state or source', () => {
    expect(() => decodeMarketHealth({ ...PAUSED, state: 'DOWN' })).toThrow();
    expect(() =>
      decodeMarketHealth({ ...PAUSED, displaySource: 'BYBIT' }),
    ).toThrow();
  });

  it('reads the reference prices as text and the incidents', () => {
    expect(
      decodeFallbackPrices({
        market: 'SPOT',
        source: 'OKX',
        asOf: '2026-11-19T07:33:00Z',
        prices: [
          {
            symbol: 'BTCUSDT',
            lastPrice: '65000.1',
            changePercent24h: '-1.25',
            high24h: null,
            low24h: null,
            volume24h: null,
            asOf: '2026-11-19T07:33:00Z',
            diverged: true,
          },
        ],
      }).prices[0],
    ).toMatchObject({ lastPrice: '65000.1', diverged: true });
    expect(
      decodeMarketIncident({
        id: 'i-1',
        market: 'SPOT',
        kind: 'MAINTENANCE',
        reason: 'MAINTENANCE',
        lastLiveAt: '2026-11-19T07:00:00Z',
        pausedAt: '2026-11-19T07:00:00Z',
        recoveryStartedAt: null,
        resumedAt: null,
        message: 'deploy',
        createdBy: null,
        expectedEndAt: '2026-11-19T08:00:00Z',
      }).expectedEndAt,
    ).toBe('2026-11-19T08:00:00Z');
  });
});

describe('HTTP market status adapter', () => {
  it('reads the status and the reference prices, and switches maintenance', async () => {
    const { calls, service } = setup((url) =>
      url.pathname.endsWith('/fallback')
        ? { market: 'FUTURES', source: 'NONE', asOf: null, prices: [] }
        : url.pathname.endsWith('/incidents')
          ? []
          : { markets: [PAUSED] },
    );

    expect((await service.status()).markets[0]?.state).toBe('PAUSED');
    expect((await service.fallback('FUTURES')).source).toBe('NONE');
    await service.maintenance({ market: 'SPOT', on: true, message: 'deploy' });
    await service.resume('FUTURES');
    expect(await service.incidents('SPOT', 20)).toEqual([]);

    expect(calls.map((call) => call.url.pathname + call.url.search)).toEqual([
      '/api/v1/market/status',
      '/api/v1/market/fallback?market=FUTURES',
      '/api/v1/admin/market/maintenance',
      '/api/v1/admin/market/resume',
      '/api/v1/admin/market/incidents?market=SPOT&limit=20',
    ]);
    expect(JSON.parse(String(calls[2]?.init.body))).toEqual({
      market: 'SPOT',
      on: true,
      message: 'deploy',
    });
    expect(JSON.parse(String(calls[3]?.init.body))).toEqual({
      market: 'FUTURES',
    });
  });

  it('subscribes to the pushes on the public feed, and to nothing without it', () => {
    const subscribeTopic = vi.fn<(destination: string) => () => void>(
      () => () => undefined,
    );
    const http = createHttpClient({
      baseUrl: 'https://api.example.test/api/v1',
      session: { accessToken: () => null, refresh: async () => 'ended' },
    });
    const service = createHttpMarketStatusService(http, {
      subscribeTopic: subscribeTopic as never,
    });

    service.subscribe(() => undefined);
    service.subscribeFallback('SPOT', () => undefined);

    expect(subscribeTopic.mock.calls.map((call) => call[0])).toEqual([
      '/topic/market.status',
      '/topic/market.fallback.SPOT',
    ]);
    expect(
      createHttpMarketStatusService(http).subscribe(() => undefined),
    ).toBeTypeOf('function');
  });

  it('shows every market live without a backend', async () => {
    const pending = createPendingMarketStatusService();
    expect(await pending.status()).toBe(ALL_LIVE);
    expect((await pending.fallback('SPOT')).prices).toEqual([]);
    await expect(pending.resume('SPOT')).rejects.toBeDefined();
  });
});
