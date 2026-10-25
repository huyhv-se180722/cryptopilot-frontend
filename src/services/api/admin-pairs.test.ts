import { describe, expect, it, vi } from 'vitest';
import { createHttpClient } from './http-client';
import {
  createHttpAdminPairService,
  createPendingAdminPairService,
} from './admin-pairs';
import { decodeAdminPair, decodePairBrackets } from './admin-pairs-dto';

/** Shapes of `/admin/pairs/**` on develop @ dccfc6c. */
const market = (status: string | null) => ({
  exchangeStatus: status,
  exchangeStatusRaw: status,
  tickSize: status ? '0.01' : null,
  stepSize: status ? '0.00001' : null,
  minNotional: status ? '5' : null,
});
const PAIR = {
  pairId: '0199a0f0-1111-7aaa-8bbb-000000000001',
  symbol: 'BTCUSDT',
  baseAsset: 'BTC',
  quoteAsset: 'USDT',
  status: 'ACTIVE',
  spotEnabled: true,
  futuresEnabled: true,
  maxLeverage: 125,
  displayOrder: 1,
  spot: market('TRADING'),
  futures: market('TRADING'),
  bracketCount: 3,
  lastSyncedAt: '2026-10-25T04:00:00Z',
  updatedAt: '2026-10-24T09:00:00Z',
};
const BRACKETS = {
  pairId: PAIR.pairId,
  symbol: 'BTCUSDT',
  brackets: [
    {
      bracketNo: 1,
      notionalFloor: '0.00000000',
      notionalCap: '50000.00000000',
      maxLeverage: 125,
      maintenanceMarginRate: '0.00400000',
      maintenanceAmount: '0.00000000',
    },
    {
      bracketNo: 2,
      notionalFloor: '50000.00000000',
      notionalCap: '600000.00000000',
      maxLeverage: 100,
      maintenanceMarginRate: '0.00500000',
      maintenanceAmount: '50.00000000',
    },
  ],
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
  return { pairs: createHttpAdminPairService(http), calls };
}

describe('admin pair decoders', () => {
  it('reads a pair with both markets, and null filters on a market never listed', () => {
    const pair = decodeAdminPair({
      ...PAIR,
      futuresEnabled: false,
      maxLeverage: null,
      futures: market(null),
      lastSyncedAt: null,
    });
    expect(pair.spot).toEqual({
      exchangeStatus: 'TRADING',
      exchangeStatusRaw: 'TRADING',
      tickSize: '0.01',
      stepSize: '0.00001',
      minNotional: '5',
    });
    expect(pair.futures.exchangeStatus).toBeNull();
    expect(pair.maxLeverage).toBeNull();
    expect(pair.lastSyncedAt).toBeNull();
  });

  it('keeps the brackets in order as decimal strings', () => {
    const read = decodePairBrackets(BRACKETS);
    expect(read.brackets.map((b) => b.maxLeverage)).toEqual([125, 100]);
    expect(read.brackets[1]?.maintenanceAmount).toBe('50.00000000');
  });

  it('rejects an unknown status or a number where a decimal belongs', () => {
    expect(() => decodeAdminPair({ ...PAIR, status: 'PAUSED' })).toThrow();
    expect(() =>
      decodeAdminPair({ ...PAIR, spot: { ...PAIR.spot, exchangeStatus: 'X' } }),
    ).toThrow();
    expect(() =>
      decodePairBrackets({
        ...BRACKETS,
        brackets: [{ ...BRACKETS.brackets[0], notionalCap: 50000 }],
      }),
    ).toThrow();
  });
});

describe('HTTP admin pair adapter', () => {
  it('lists with the search and status, and searches the exchange symbols', async () => {
    const { pairs, calls } = setup((url) =>
      url.pathname.endsWith('/exchange-symbols')
        ? [
            {
              symbol: 'SUIUSDT',
              baseAsset: 'SUI',
              quoteAsset: 'USDT',
              spotTrading: true,
              futuresTrading: false,
            },
          ]
        : [PAIR],
    );
    expect(await pairs.list({ q: 'BTC', status: 'ACTIVE' })).toHaveLength(1);
    expect(calls[0]?.url.pathname).toBe('/api/v1/admin/pairs');
    expect(calls[0]?.url.search).toBe('?q=BTC&status=ACTIVE');
    await pairs.list({});
    expect(calls[1]?.url.search).toBe('');
    const [found] = await pairs.exchangeSymbols('SUI');
    expect(found?.futuresTrading).toBe(false);
    expect(calls[2]?.url.search).toBe('?q=SUI');
  });

  it('registers, updates the settings and replaces the brackets without amounts', async () => {
    const { pairs, calls } = setup((url) =>
      url.pathname.endsWith('/brackets') ? BRACKETS : PAIR,
    );
    await pairs.register('BTCUSDT');
    expect(calls[0]?.init.method).toBe('POST');
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({
      symbol: 'BTCUSDT',
    });
    await pairs.update(PAIR.pairId, {
      status: 'ACTIVE',
      spotEnabled: true,
      futuresEnabled: true,
      maxLeverage: 100,
      displayOrder: 2,
    });
    expect(calls[1]?.init.method).toBe('PUT');
    expect(calls[1]?.url.pathname).toBe('/api/v1/admin/pairs/' + PAIR.pairId);
    expect(JSON.parse(String(calls[1]?.init.body))).toEqual({
      status: 'ACTIVE',
      spotEnabled: true,
      futuresEnabled: true,
      maxLeverage: 100,
      displayOrder: 2,
    });
    await pairs.replaceBrackets(PAIR.pairId, [
      {
        notionalFloor: '0',
        notionalCap: '50000',
        maxLeverage: 125,
        maintenanceMarginRate: '0.004',
      },
    ]);
    expect(calls[2]?.url.pathname).toBe(
      '/api/v1/admin/pairs/' + PAIR.pairId + '/brackets',
    );
    // BR-27: the server works the maintenance amount out.
    expect(JSON.parse(String(calls[2]?.init.body))).toEqual({
      brackets: [
        {
          notionalFloor: '0',
          notionalCap: '50000',
          maxLeverage: 125,
          maintenanceMarginRate: '0.004',
        },
      ],
    });
  });

  it('is pending while no API is configured', async () => {
    await expect(
      createPendingAdminPairService().list({}),
    ).rejects.toMatchObject({ code: 'NOT_CONFIGURED' });
  });
});
