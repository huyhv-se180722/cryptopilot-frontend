import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MarketService } from '../services/api/contracts';
import type { MarketTicker, Session } from '../types/domain';
import { createDevelopmentPaperTrading } from './dev-paper-trading';
import { DEV_PAIR_IDS } from './fixtures/watchlist';

const BTC = DEV_PAIR_IDS.BTCUSDT!;
const session = { user: { id: 'u-1' } } as unknown as Session;

/** A market whose last prices the test sets. */
function setup(prices: Record<string, string> = { BTCUSDT: '60000' }) {
  const market = {
    getTicker: vi.fn(
      async (_market: string, symbol: string) =>
        ({ lastPrice: prices[symbol] ?? '1' }) as MarketTicker,
    ),
  } as unknown as MarketService;
  const { paperTrading } = createDevelopmentPaperTrading(
    async () => session,
    market,
    () => Date.UTC(2026, 9, 13),
  );
  return { paperTrading, prices };
}

const spot = async (
  service: ReturnType<typeof setup>['paperTrading'],
  asset: string,
) => (await service.getWallet('SPOT')).balances.find((b) => b.asset === asset);

afterEach(() => vi.useRealTimers());

describe('development demo exchange (TR-04, TR-06, TR-07 answers)', () => {
  it('opens the account once with the Q-T5 grant', async () => {
    const { paperTrading } = setup();
    const first = await paperTrading.openAccount();
    expect(await paperTrading.openAccount()).toBe(first);
    expect(await spot(paperTrading, 'USDT')).toMatchObject({
      free: '10000',
      locked: '0',
    });
    expect(
      (await paperTrading.getWallet('FUTURES')).balances.map((b) => [
        b.asset,
        b.total,
      ]),
    ).toEqual([['USDT', '5000']]);
  });

  it('answers MSG44 without a session and MSG41 before the account opens', async () => {
    const market = {} as MarketService;
    const anonymous = createDevelopmentPaperTrading(async () => null, market);
    await expect(anonymous.paperTrading.openAccount()).rejects.toMatchObject({
      status: 401,
      problem: { messageCode: 'MSG44' },
    });
    const { paperTrading } = setup();
    await expect(paperTrading.getWallet('SPOT')).rejects.toMatchObject({
      status: 404,
      problem: { messageCode: 'MSG41' },
    });
  });

  it('fills a MARKET buy at the last price as taker, fee in the coin received', async () => {
    const { paperTrading } = setup();
    await paperTrading.openAccount();
    const order = await paperTrading.placeOrder({
      pairId: BTC,
      market: 'spot',
      side: 'BUY',
      type: 'MARKET',
      quantity: '0.01',
      clientOrderId: 'c-1',
    });
    expect(order).toMatchObject({
      status: 'FILLED',
      executedQuantity: '0.01000',
      avgPrice: '60000',
    });
    // 0.1 BTC granted + 0.01 − 0.00001 fee; 10,000 − 600 USDT.
    expect((await spot(paperTrading, 'BTC'))?.free).toBe('0.10999');
    expect((await spot(paperTrading, 'USDT'))?.free).toBe('9400');
    const fills = await paperTrading.fills({ page: 1, pageSize: 20 });
    expect(fills.items[0]).toMatchObject({
      liquidity: 'TAKER',
      fee: '0.00001000',
      feeAsset: 'BTC',
    });
    // The same clientOrderId returns the same order (idempotency).
    expect(
      await paperTrading.placeOrder({
        pairId: BTC,
        market: 'spot',
        side: 'BUY',
        type: 'MARKET',
        quantity: '0.01',
        clientOrderId: 'c-1',
      }),
    ).toBe(order);
  });

  it('keeps a LIMIT that does not cross waiting, locks its funds and fills it as maker later', async () => {
    vi.useFakeTimers();
    const { paperTrading, prices } = setup();
    await paperTrading.openAccount();
    const order = await paperTrading.placeOrder({
      pairId: BTC,
      market: 'spot',
      side: 'BUY',
      type: 'LIMIT',
      price: '59000.004',
      quantity: '0.020009',
      clientOrderId: 'c-2',
    });
    // Price on the tick, quantity floored to the step.
    expect(order).toMatchObject({
      status: 'NEW',
      price: '59000.00',
      quantity: '0.02000',
    });
    expect(await spot(paperTrading, 'USDT')).toMatchObject({
      free: '8820',
      locked: '1180',
    });
    expect(await paperTrading.openOrders(BTC)).toHaveLength(1);
    prices.BTCUSDT = '58999';
    await vi.advanceTimersByTimeAsync(1_000);
    expect((await paperTrading.openOrders(null)).length).toBe(0);
    const fills = await paperTrading.fills({
      pairId: BTC,
      page: 1,
      pageSize: 20,
    });
    expect(fills.items[0]).toMatchObject({
      liquidity: 'MAKER',
      price: '59000.00',
    });
    expect((await spot(paperTrading, 'USDT'))?.locked).toBe('0');
  });

  it('cancels a working order, releases its lock and refuses a finished one', async () => {
    const { paperTrading } = setup();
    await paperTrading.openAccount();
    const order = await paperTrading.placeOrder({
      pairId: BTC,
      market: 'spot',
      side: 'SELL',
      type: 'LIMIT',
      price: '70000',
      quantity: '0.05',
      clientOrderId: 'c-3',
    });
    expect((await spot(paperTrading, 'BTC'))?.locked).toBe('0.05');
    const [canceled] = await paperTrading.cancelAll(BTC);
    expect(canceled).toMatchObject({ status: 'CANCELED' });
    expect((await spot(paperTrading, 'BTC'))?.free).toBe('0.1');
    await expect(paperTrading.cancelOrder(order.orderId)).rejects.toMatchObject(
      {
        status: 409,
        problem: { code: 'PAPER_ORDER_NOT_OPEN', messageCode: 'MSG43' },
      },
    );
  });

  it('refuses what the backend refuses', async () => {
    const { paperTrading } = setup();
    await paperTrading.openAccount();
    const base = { market: 'spot' as const, clientOrderId: 'x' };
    await expect(
      paperTrading.placeOrder({
        ...base,
        pairId: BTC,
        side: 'BUY',
        type: 'LIMIT',
        price: '60000',
        quantity: '1',
      }),
    ).rejects.toMatchObject({
      problem: { code: 'PAPER_INSUFFICIENT_BALANCE', messageCode: 'MSG01' },
    });
    await expect(
      paperTrading.placeOrder({
        ...base,
        clientOrderId: 'y',
        pairId: BTC,
        side: 'BUY',
        type: 'MARKET',
        quantity: '0.00001',
      }),
    ).rejects.toMatchObject({
      problem: { messageCode: 'MSG15', fieldErrors: { quantity: 'MSG15' } },
    });
    await expect(
      paperTrading.placeOrder({
        ...base,
        clientOrderId: 'z',
        pairId: 'unknown',
        side: 'BUY',
        type: 'MARKET',
        quantity: '1',
      }),
    ).rejects.toMatchObject({ problem: { messageCode: 'MSG41' } });
    const expired = await paperTrading.placeOrder({
      ...base,
      clientOrderId: 'w',
      pairId: BTC,
      side: 'BUY',
      type: 'LIMIT',
      timeInForce: 'IOC',
      price: '50000',
      quantity: '0.01',
    });
    expect(expired).toMatchObject({
      status: 'EXPIRED',
      statusReason: 'IOC_NOT_FILLABLE',
    });
  });

  it('moves USDT between the wallets once per clientTransferId', async () => {
    const { paperTrading } = setup();
    await paperTrading.openAccount();
    const transfer = {
      asset: 'USDT' as const,
      from: 'SPOT' as const,
      amount: '250.5',
      clientTransferId: 't-1',
    };
    const first = await paperTrading.transfer(transfer);
    expect(await paperTrading.transfer(transfer)).toBe(first);
    expect((await spot(paperTrading, 'USDT'))?.free).toBe('9749.5');
    await expect(
      paperTrading.transfer({
        ...transfer,
        amount: '99999',
        clientTransferId: 't-2',
      }),
    ).rejects.toMatchObject({
      problem: { code: 'PAPER_INSUFFICIENT_BALANCE' },
    });
  });
});
