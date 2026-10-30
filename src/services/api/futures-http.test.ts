import { describe, expect, it, vi } from 'vitest';
import { createHttpClient } from './http-client';
import { createHttpFuturesTradingService } from './futures';
import type { AccountFeed } from './paper-trading';

/** Shapes of the backend's paper Futures DTOs on `feat/futures-f1-isolated` @ f21d424. */
const ORDER = {
  orderId: '01a18bcc-0ab7-7030-a727-08b429097975',
  clientOrderId: 'web-1',
  symbol: 'BTCUSDT',
  status: 'NEW',
  statusReason: null,
  type: 'LIMIT',
  origType: 'LIMIT',
  side: 'BUY',
  positionSide: 'BOTH',
  timeInForce: 'GTC',
  price: '60000.0',
  avgPrice: '0',
  origQty: '0.100',
  executedQty: '0',
  cumQuote: '0',
  reduceOnly: false,
  closePosition: false,
  stopPrice: '0',
  workingType: 'CONTRACT_PRICE',
  priceProtect: false,
  priceMatch: 'NONE',
  selfTradePreventionMode: 'NONE',
  goodTillDate: null,
  time: '2026-10-30T08:00:00Z',
  updateTime: '2026-10-30T08:00:00Z',
};
const POSITION = {
  symbol: 'BTCUSDT',
  positionSide: 'BOTH',
  positionAmt: '-0.100',
  entryPrice: '60000',
  breakEvenPrice: '60000',
  markPrice: '59000',
  unRealizedProfit: '100.00000000',
  liquidationPrice: '65000.0',
  isolatedMargin: '0',
  notional: '-5900',
  marginAsset: 'USDT',
  isolatedWallet: '0',
  initialMargin: '295',
  maintMargin: '23.6',
  positionInitialMargin: '295',
  openOrderInitialMargin: '0',
  adl: 0,
  bidNotional: '0',
  askNotional: '0',
  marginType: 'CROSSED',
  leverage: 20,
  marginRatio: null,
  updateTime: '2026-10-30T08:00:00Z',
};

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

describe('HTTP paper Futures adapter (D-127)', () => {
  it('places an order on /paper/futures/order and decodes it', async () => {
    const { http, calls } = setup(() => json(200, ORDER));
    const futures = createHttpFuturesTradingService(http);

    const order = await futures.placeOrder({
      symbol: 'BTCUSDT',
      side: 'BUY',
      type: 'LIMIT',
      timeInForce: 'GTC',
      price: '60000.0',
      quantity: '0.100',
    });

    expect(calls[0]?.url.pathname).toBe('/api/v1/paper/futures/order');
    expect(calls[0]?.init.method).toBe('POST');
    expect(order).toMatchObject({ status: 'NEW', positionSide: 'BOTH' });
  });

  it('reads positions, cancels by symbol and order id, and sends algo orders as CONDITIONAL', async () => {
    const { http, calls } = setup((url) =>
      url.pathname.endsWith('positionRisk')
        ? json(200, [POSITION])
        : url.pathname.endsWith('algoOrder')
          ? json(400, { code: 'VALIDATION_FAILED' })
          : json(200, { ...ORDER, status: 'CANCELED' }),
    );
    const futures = createHttpFuturesTradingService(http);

    const [position] = await futures.positions('BTCUSDT');
    await futures.cancelOrder('BTCUSDT', ORDER.orderId);
    await expect(
      futures.placeAlgoOrder({
        symbol: 'BTCUSDT',
        side: 'SELL',
        type: 'STOP_MARKET',
        triggerPrice: '58000',
        closePosition: true,
      }),
    ).rejects.toBeDefined();

    expect(position).toMatchObject({
      positionAmt: '-0.100',
      marginRatio: null,
    });
    expect(calls[1]?.url.search).toBe(
      '?symbol=BTCUSDT&orderId=' + ORDER.orderId,
    );
    expect(JSON.parse(String(calls[2]?.init.body))).toMatchObject({
      algoType: 'CONDITIONAL',
      type: 'STOP_MARKET',
    });
  });

  it('turns the Futures queues into one stream of events', () => {
    const subscriptions: string[] = [];
    const handlers = new Map<string, (value: unknown) => void>();
    const feed = {
      subscribeTopic: (
        destination: string,
        decode: (body: unknown) => unknown,
        listener: (value: unknown) => void,
      ) => {
        subscriptions.push(destination);
        handlers.set(destination, (body) => listener(decode(body)));
        return () => undefined;
      },
      status: () => 'open',
      onStatus: () => () => undefined,
    } as unknown as AccountFeed;
    const { http } = setup(() => json(200, {}));
    const events: string[] = [];

    createHttpFuturesTradingService(http, feed).subscribe((event) =>
      events.push(event.kind),
    );
    handlers.get('/user/queue/futures.orders')?.({ order: ORDER, trades: [] });
    handlers.get('/user/queue/futures.config')?.({ symbol: 'BTCUSDT' });

    expect(subscriptions).toHaveLength(5);
    expect(events).toEqual(['order', 'config']);
  });
});
