import { describe, expect, it, vi } from 'vitest';
import { ServiceError } from './errors';
import { createHttpClient } from './http-client';
import {
  createHttpMarketTestToolsService,
  createPendingMarketTestToolsService,
  decodeReplayScenario,
  decodeRunningReplay,
  decodeStreamCut,
  toolsAbsent,
} from './market-test-tools';

/** Bodies of backend feat/rf12-market-stream-fault-switch. */
const SCENARIO = {
  name: 'btc_liq',
  description: 'BTC falls through a long position liquidation price',
  market: 'FUTURES',
  symbol: 'BTCUSDT',
  lengthSeconds: 120,
  firstPrice: '60000',
  lastPrice: '52000',
};
const REPLAY = {
  scenario: 'btc_liq',
  market: 'FUTURES',
  symbol: 'BTCUSDT',
  startedAt: '2026-11-28T08:00:00Z',
  endsAt: '2026-11-28T08:02:00Z',
  price: '58400.5',
};
const CUT = {
  market: 'SPOT',
  connectionsCut: 3,
  cutAt: '2026-11-28T08:00:00Z',
  reconnectFrom: '2026-11-28T08:00:45Z',
};

function setup(
  answer: (url: URL, init: RequestInit) => { status: number; body?: unknown },
) {
  const calls: { url: URL; init: RequestInit }[] = [];
  const http = createHttpClient({
    baseUrl: 'https://api.example.test/api/v1',
    fetcher: vi.fn<typeof fetch>(async (input, init = {}) => {
      const url = new URL(String(input));
      calls.push({ url, init });
      const { status, body } = answer(url, init);
      return new Response(status === 204 ? null : JSON.stringify(body ?? {}), {
        status,
      });
    }),
    session: { accessToken: () => 'token-1', refresh: async () => 'renewed' },
  });
  return { calls, service: createHttpMarketTestToolsService(http) };
}

describe('market test tools decoders', () => {
  it('reads a scenario, a running replay and a stream cut', () => {
    expect(decodeReplayScenario(SCENARIO)).toEqual(SCENARIO);
    expect(decodeRunningReplay(REPLAY)).toEqual(REPLAY);
    expect(decodeStreamCut(CUT)).toEqual(CUT);
  });

  it('rejects an unknown market', () => {
    expect(() =>
      decodeRunningReplay({ ...REPLAY, market: 'MARGIN' }),
    ).toThrow();
  });
});

describe('market test tools service', () => {
  it('calls the admin market paths with their bodies', async () => {
    const { calls, service } = setup((url, init) => {
      if (url.pathname.endsWith('/replay/scenarios'))
        return { status: 200, body: [SCENARIO] };
      if (url.pathname.endsWith('/replay/stop')) return { status: 204 };
      if (url.pathname.endsWith('/stream-cut'))
        return { status: 200, body: CUT };
      return { status: 200, body: init.method === 'POST' ? REPLAY : [REPLAY] };
    });
    expect(await service.scenarios()).toEqual([SCENARIO]);
    expect(await service.replays()).toEqual([REPLAY]);
    expect(await service.startReplay('btc_liq')).toEqual(REPLAY);
    await service.stopReplay('FUTURES', 'BTCUSDT');
    expect(await service.cutStreams('SPOT', 45)).toEqual(CUT);
    expect(
      calls.map((call) => [call.init.method ?? 'GET', call.url.pathname]),
    ).toEqual([
      ['GET', '/api/v1/admin/market/replay/scenarios'],
      ['GET', '/api/v1/admin/market/replay'],
      ['POST', '/api/v1/admin/market/replay'],
      ['POST', '/api/v1/admin/market/replay/stop'],
      ['POST', '/api/v1/admin/market/fault/stream-cut'],
    ]);
    expect(JSON.parse(String(calls[2]?.init.body))).toEqual({
      scenario: 'btc_liq',
    });
    expect(JSON.parse(String(calls[3]?.init.body))).toEqual({
      market: 'FUTURES',
      symbol: 'BTCUSDT',
    });
    expect(JSON.parse(String(calls[4]?.init.body))).toEqual({
      market: 'SPOT',
      outageSeconds: 45,
    });
  });

  it('names a 404 or a missing backend as tools absent, not other errors', async () => {
    const { service } = setup(() => ({ status: 404, body: { status: 404 } }));
    const missing = await service.scenarios().catch((error: unknown) => error);
    expect(toolsAbsent(missing)).toBe(true);
    const pending = await createPendingMarketTestToolsService()
      .scenarios()
      .catch((error: unknown) => error);
    expect(toolsAbsent(pending)).toBe(true);
    expect(toolsAbsent(new ServiceError('x', 'HTTP_ERROR', 500))).toBe(false);
    expect(toolsAbsent(new Error('x'))).toBe(false);
  });
});
