import { describe, expect, it, vi } from 'vitest';
import { createHttpClient } from './http-client';
import { createHttpMarketService, createPendingMarketService } from './market';
import { decodeOverview, decodePairPage, decodeTicker } from './market-dto';

/** Response shapes of the backend `/market/**` endpoints on develop @ 0d92def. */
const pair = (symbol: string, displayOrder: number) => ({
  symbol,
  market: 'SPOT',
  baseAsset: symbol.replace('USDT', ''),
  quoteAsset: 'USDT',
  baseAssetName: null,
  logoUrl: null,
  tickSize: '0.01000000',
  stepSize: '0.00001',
  minNotional: '5',
  displayOrder,
});
const SPOT_TICKER = {
  market: 'SPOT',
  symbol: 'BTCUSDT',
  sourceTime: '2026-10-03T02:15:04.120Z',
  lastPrice: '63000.01',
  bestBid: '63000.00',
  bestAsk: '63000.01',
  high24h: '63950.00',
  low24h: '61820.50',
  changePercent24h: '-1.254',
  baseVolume24h: '18234.11',
  quoteVolume24h: '1139455120.42',
  markPrice: null,
  indexPrice: null,
  fundingRate: null,
  nextFundingTime: null,
};

const json = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status });

function setup(reply: (url: URL) => Response) {
  const urls: URL[] = [];
  const headers: Headers[] = [];
  const fetcher = vi.fn<typeof fetch>(async (input, init = {}) => {
    const url = new URL(String(input));
    urls.push(url);
    headers.push(new Headers(init.headers));
    return reply(url);
  });
  const http = createHttpClient({
    baseUrl: 'https://api.example.test/api/v1',
    fetcher,
    session: {
      accessToken: () => 'token-1',
      refresh: async () => 'renewed',
    },
  });
  return { market: createHttpMarketService(http), urls, headers };
}

describe('market decoders', () => {
  it('maps the wire market and keeps decimals as strings', () => {
    const ticker = decodeTicker(SPOT_TICKER);
    expect(ticker.market).toBe('spot');
    expect(ticker.changePercent24h).toBe('-1.254');
    expect(ticker.fundingRate).toBeNull();
    expect(() => decodeTicker({ ...SPOT_TICKER, market: 'MARGIN' })).toThrow();
    expect(() => decodeTicker({ ...SPOT_TICKER, lastPrice: 63000 })).toThrow();
  });

  it('decodes the overview and rejects a malformed pair page', () => {
    expect(
      decodeOverview({
        market: 'FUTURES',
        serverTime: '2026-10-03T02:15:06Z',
        tickers: [{ ...SPOT_TICKER, market: 'FUTURES', lastPrice: null }],
      }).tickers[0]?.market,
    ).toBe('futures');
    expect(() => decodePairPage({ items: [{}], total: 1 })).toThrow();
  });
});

describe('HTTP market adapter', () => {
  it('reads every page of pairs anonymously, in display order', async () => {
    const firstPage = Array.from({ length: 100 }, (_, i) =>
      pair('P' + i + 'USDT', 200 - i),
    );
    const { market, urls, headers } = setup((url) =>
      url.searchParams.get('page') === '1'
        ? json(200, { items: firstPage, page: 1, pageSize: 100, total: 101 })
        : json(200, {
            items: [pair('BTCUSDT', 1)],
            page: 2,
            pageSize: 100,
            total: 101,
          }),
    );
    const pairs = await market.listPairs('spot');
    expect(pairs).toHaveLength(101);
    expect(pairs[0]?.symbol).toBe('BTCUSDT');
    expect(urls.map((url) => url.search)).toEqual([
      '?market=spot&page=1&pageSize=100',
      '?market=spot&page=2&pageSize=100',
    ]);
    expect(headers.every((h) => h.get('Authorization') === null)).toBe(true);
  });

  it('reads candles and the ticker snapshots of both markets', async () => {
    const { market, urls } = setup((url) => {
      if (url.pathname.endsWith('/candles'))
        return json(200, {
          symbol: 'BTCUSDT',
          market: 'SPOT',
          timeframe: '1d',
          candles: [
            {
              openTime: '2026-10-02T00:00:00Z',
              closeTime: '2026-10-02T23:59:59.999Z',
              open: '1',
              high: '2',
              low: '0.5',
              close: '1.5',
              baseVolume: '10',
              quoteVolume: '15',
              tradeCount: null,
            },
          ],
        });
      if (url.pathname.includes('/spot/'))
        return json(200, {
          symbol: 'BTCUSDT',
          serverTime: '2026-10-03T02:15:30Z',
          ticker: null,
        });
      return json(200, {
        symbol: 'BTCUSDT',
        serverTime: '2026-10-03T02:15:30Z',
        price: {
          asOf: '2026-10-03T02:15:00Z',
          markPrice: '63010.20',
          indexPrice: '63005.80',
          fundingRate: '0.00010000',
          nextFundingTime: '2026-10-03T08:00:00Z',
        },
        openInterest: null,
        longShortRatio: null,
        lastFundingSettlement: null,
      });
    });
    const candles = await market.getCandles({
      market: 'spot',
      symbol: 'btcusdt',
      timeframe: '1d',
      limit: 90,
    });
    expect(candles[0]).toEqual({
      openTime: '2026-10-02T00:00:00Z',
      open: '1',
      high: '2',
      low: '0.5',
      close: '1.5',
      quoteVolume: '15',
    });
    expect(await market.getTicker('spot', 'BTCUSDT')).toBeNull();
    expect(await market.getTicker('futures', 'BTCUSDT')).toMatchObject({
      market: 'futures',
      markPrice: '63010.20',
      fundingRate: '0.00010000',
      lastPrice: null,
      sourceTime: '2026-10-03T02:15:00Z',
    });
    expect(urls.map((url) => url.pathname + url.search)).toEqual([
      '/api/v1/market/spot/btcusdt/candles?tf=1d&limit=90',
      '/api/v1/market/spot/BTCUSDT/stats',
      '/api/v1/market/futures/BTCUSDT/stats',
    ]);
  });

  it('keeps MSG41 for a pair that is not enabled', async () => {
    const { market } = setup(() =>
      json(404, { code: 'RESOURCE_NOT_FOUND', messageCode: 'MSG41' }),
    );
    await expect(market.getTicker('spot', 'XYZUSDT')).rejects.toMatchObject({
      problem: { messageCode: 'MSG41' },
    });
  });

  it('is pending while no API is configured', async () => {
    await expect(
      createPendingMarketService().listPairs('spot'),
    ).rejects.toMatchObject({ code: 'NOT_CONFIGURED' });
  });
});
