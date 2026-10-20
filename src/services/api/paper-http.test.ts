import { describe, expect, it, vi } from 'vitest';
import type { StompTopics } from '../websocket/stomp-market-feed';
import { createHttpClient } from './http-client';
import { createHttpPaperTradingService } from './paper-trading';
import { createHttpTradingMarketService } from './trading-market';

/** Shapes of the backend's paper DTOs on `feat/tr-02-paper-trading-schema` @ f4e66b2. */
const ORDER = {
  orderId: '0199b000-0000-7000-8000-000000000001',
  clientOrderId: 'web-1',
  pairId: '0199a0f0-1111-7aaa-8bbb-000000000001',
  symbol: 'BTCUSDT',
  market: 'SPOT',
  side: 'BUY',
  type: 'LIMIT',
  timeInForce: 'GTC',
  price: '59000.00',
  quantity: '0.01000',
  quoteOrderQty: null,
  executedQuantity: '0',
  cumQuote: '0',
  avgPrice: null,
  status: 'NEW',
  statusReason: null,
  placedAt: '2026-10-13T09:00:00Z',
  closedAt: null,
};
const page = (items: unknown[]) => ({
  items,
  page: 1,
  pageSize: 20,
  total: items.length,
});

const json = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status });

function setup(reply: (url: URL, init: RequestInit) => Response) {
  const calls: { url: URL; init: RequestInit }[] = [];
  const fetcher = vi.fn<typeof fetch>(async (input, init = {}) => {
    const url = new URL(String(input));
    calls.push({ url, init });
    return reply(url, init);
  });
  const http = createHttpClient({
    baseUrl: 'https://api.example.test/api/v1',
    fetcher,
    session: { accessToken: () => 'token-1', refresh: async () => 'renewed' },
  });
  return { http, calls };
}

describe('HTTP demo trading adapter (D-104)', () => {
  it('places an order with the market upper case and decodes it', async () => {
    const { http, calls } = setup(() => json(201, ORDER));
    const paper = createHttpPaperTradingService(http);
    const order = await paper.placeOrder({
      pairId: ORDER.pairId,
      market: 'spot',
      side: 'BUY',
      type: 'LIMIT',
      timeInForce: 'GTC',
      price: '59000',
      quantity: '0.01',
      clientOrderId: 'web-1',
    });
    expect(order).toMatchObject({
      market: 'spot',
      status: 'NEW',
      price: '59000.00',
    });
    const { url, init } = calls[0]!;
    expect(url.pathname).toBe('/api/v1/paper/orders');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({
      pairId: ORDER.pairId,
      market: 'SPOT',
      side: 'BUY',
      type: 'LIMIT',
      timeInForce: 'GTC',
      price: '59000',
      quantity: '0.01',
      clientOrderId: 'web-1',
    });
    expect(new Headers(init.headers).get('Authorization')).toBe(
      'Bearer token-1',
    );
  });

  it('reads histories with only the filters given', async () => {
    const { http, calls } = setup((url) =>
      url.pathname.endsWith('/orders/open')
        ? json(200, [ORDER])
        : json(200, page([])),
    );
    const paper = createHttpPaperTradingService(http);
    await paper.orders({
      status: 'FILLED',
      from: '2026-10-06T00:00:00Z',
      page: 2,
      pageSize: 20,
    });
    await paper.fills({ pairId: ORDER.pairId, page: 1, pageSize: 20 });
    await paper.ledger({ wallet: 'SPOT', type: 'FEE', page: 1, pageSize: 20 });
    await paper.transfers({ page: 1, pageSize: 20 });
    expect(await paper.openOrders(null)).toHaveLength(1);
    await paper.cancelAll(ORDER.pairId);
    expect(
      calls.map(
        ({ url, init }) =>
          `${init.method ?? 'GET'} ${url.pathname}${url.search}`,
      ),
    ).toEqual([
      'GET /api/v1/paper/orders?status=FILLED&from=2026-10-06T00%3A00%3A00Z&page=2&pageSize=20',
      `GET /api/v1/paper/fills?pairId=${ORDER.pairId}&page=1&pageSize=20`,
      'GET /api/v1/paper/ledger?wallet=SPOT&type=FEE&page=1&pageSize=20',
      'GET /api/v1/paper/transfers?page=1&pageSize=20',
      'GET /api/v1/paper/orders/open',
      `DELETE /api/v1/paper/orders/open?pairId=${ORDER.pairId}`,
    ]);
  });

  it('decodes a wallet, a ledger page and refuses an unknown status', async () => {
    const { http } = setup((url) =>
      url.pathname.endsWith('/wallets/SPOT')
        ? json(200, {
            wallet: 'SPOT',
            balances: [
              {
                coinId: 'c-1',
                asset: 'USDT',
                free: '9410.00000000',
                locked: '590.00000000',
                total: '10000.00000000',
                usdtValue: '10000.00000000',
              },
            ],
            estimatedUsdt: '10000.00000000',
            estimatedBtc: null,
            complete: true,
          })
        : url.pathname.endsWith('/ledger')
          ? json(
              200,
              page([
                {
                  entryId: 'e-1',
                  wallet: 'SPOT',
                  asset: 'USDT',
                  type: 'INITIAL_GRANT',
                  amount: '10000',
                  balanceAfter: '10000',
                  refType: 'ACCOUNT',
                  refId: null,
                  createdAt: '2026-10-13T09:00:00Z',
                },
              ]),
            )
          : json(200, { ...ORDER, status: 'LOST' }),
    );
    const paper = createHttpPaperTradingService(http);
    expect((await paper.getWallet('SPOT')).balances[0]).toMatchObject({
      locked: '590.00000000',
    });
    expect((await paper.ledger({ page: 1, pageSize: 20 })).items[0]?.type).toBe(
      'INITIAL_GRANT',
    );
    await expect(paper.cancelOrder(ORDER.orderId)).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    });
  });

  it('keeps the backend refusal for the form (insufficient balance)', async () => {
    const { http } = setup(() =>
      json(400, {
        status: 400,
        code: 'PAPER_INSUFFICIENT_BALANCE',
        messageCode: 'MSG01',
        messageArgs: [],
        errors: {},
      }),
    );
    await expect(
      createHttpPaperTradingService(http).transfer({
        asset: 'USDT',
        from: 'SPOT',
        amount: '1',
        clientTransferId: 't-1',
      }),
    ).rejects.toMatchObject({
      problem: { code: 'PAPER_INSUFFICIENT_BALANCE' },
    });
  });
});

describe('HTTP depth and trades adapter (TR-03, D-104)', () => {
  it('reads depth and trades anonymously and follows the topics in upper case', async () => {
    const { http, calls } = setup((url) =>
      url.pathname.endsWith('/depth')
        ? json(200, {
            market: 'SPOT',
            symbol: 'BTCUSDT',
            lastUpdateId: 42,
            receivedAt: '2026-10-13T09:00:00Z',
            bids: [['63000.00', '0.5']],
            asks: [['63000.01', '0.2']],
          })
        : json(200, {
            market: 'SPOT',
            symbol: 'BTCUSDT',
            trades: [
              {
                id: 7,
                price: '63000.00',
                quantity: '0.01',
                time: '2026-10-13T09:00:00Z',
                buyerMaker: true,
              },
            ],
          }),
    );
    const destinations: string[] = [];
    const topics: StompTopics = {
      subscribeTopic: (destination) => {
        destinations.push(destination);
        return () => undefined;
      },
    };
    const service = createHttpTradingMarketService(http, topics);
    expect(await service.getDepth('spot', 'BTCUSDT')).toMatchObject({
      lastUpdateId: 42,
      bids: [{ price: '63000.00', quantity: '0.5' }],
    });
    expect((await service.getTrades('spot', 'BTCUSDT', 50))[0]).toMatchObject({
      id: 7,
      buyerMaker: true,
    });
    expect(calls.map(({ url }) => url.pathname + url.search)).toEqual([
      '/api/v1/market/spot/BTCUSDT/depth',
      '/api/v1/market/spot/BTCUSDT/trades?limit=50',
    ]);
    expect(
      calls.every(
        ({ init }) => !new Headers(init.headers).has('Authorization'),
      ),
    ).toBe(true);
    service.subscribeDepth('spot', 'btcusdt', () => undefined);
    service.subscribeTrades('spot', 'btcusdt', () => undefined);
    expect(destinations).toEqual([
      '/topic/depth.SPOT.BTCUSDT',
      '/topic/trades.SPOT.BTCUSDT',
    ]);
  });
});

describe('account pushes (TR-08)', () => {
  it('follows the three user queues and decodes each push', () => {
    const { http } = setup(() => json(200, {}));
    const listeners = new Map<string, (body: unknown) => void>();
    let status: 'open' | 'connecting' = 'connecting';
    const feed = {
      subscribeTopic: <T>(
        destination: string,
        decode: (body: unknown) => T,
        listener: (value: T) => void,
      ) => {
        listeners.set(destination, (body) => listener(decode(body)));
        return () => listeners.delete(destination);
      },
      status: () => status,
      onStatus: () => () => undefined,
    };
    const paper = createHttpPaperTradingService(http, feed);
    const events: unknown[] = [];
    const stop = paper.subscribeAccount((event) => events.push(event));
    expect([...listeners.keys()]).toEqual([
      '/user/queue/orders',
      '/user/queue/fills',
      '/user/queue/balances',
    ]);
    listeners.get('/user/queue/orders')?.({ ...ORDER, status: 'FILLED' });
    listeners.get('/user/queue/fills')?.({
      fillId: 'f-1',
      orderId: ORDER.orderId,
      pairId: ORDER.pairId,
      symbol: 'BTCUSDT',
      market: 'SPOT',
      side: 'BUY',
      price: '59000.00',
      quantity: '0.01000',
      quoteAmount: '590.00',
      fee: '0.00001',
      feeAsset: 'BTC',
      liquidity: 'MAKER',
      source: 'LIVE',
      tradedAt: '2026-10-13T09:00:01Z',
    });
    listeners.get('/user/queue/balances')?.({
      wallet: 'SPOT',
      coinId: 'c-btc',
      asset: 'BTC',
      free: '0.10999000',
      locked: '0.00000000',
      total: '0.10999000',
    });
    expect(events).toMatchObject([
      { kind: 'order', order: { status: 'FILLED', market: 'spot' } },
      { kind: 'fill', fill: { fillId: 'f-1', liquidity: 'MAKER' } },
      {
        kind: 'balance',
        balance: { wallet: 'SPOT', asset: 'BTC', free: '0.10999000' },
      },
    ]);
    status = 'open';
    expect(paper.accountFeedStatus()).toBe('open');
    stop();
    expect(listeners.size).toBe(0);
  });

  it('has no pushes without a signed-in connection', () => {
    const { http } = setup(() => json(200, {}));
    const paper = createHttpPaperTradingService(http);
    expect(paper.accountFeedStatus()).toBe('unavailable');
    expect(() => paper.subscribeAccount(() => undefined)()).not.toThrow();
  });
});
