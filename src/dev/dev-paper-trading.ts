import type {
  MarketService,
  PaperTradingService,
} from '../services/api/contracts';
import { ServiceError } from '../services/api/errors';
import type {
  MarketPair,
  OrderSide,
  PaperAccount,
  PaperBalance,
  PaperFill,
  PaperOrder,
  PaperPage,
  PaperTransfer,
  PaperWalletType,
  PlacePaperOrder,
  Session,
} from '../types/domain';
import {
  add,
  compare,
  divide,
  isPositive,
  multiply,
  subtract,
  toStep,
} from '../utils/decimal-math';
import { devPairs } from './fixtures/market';
import { DEV_PAIR_IDS } from './fixtures/watchlist';

/** The grant of plan Q-T5, as the backend's default configuration. */
const GRANT: Readonly<
  Record<PaperWalletType, Readonly<Record<string, string>>>
> = {
  SPOT: { USDT: '10000', BTC: '0.1', ETH: '1', BNB: '10' },
  FUTURES: { USDT: '5000' },
};
/** The backend's default Spot fee (maker and taker 0.1 %), scripted here. */
const FEE_RATE = '0.001';
const QUOTE = 'USDT';

function refuse(
  status: number,
  code: string,
  messageCode: string,
  fieldErrors: Readonly<Record<string, string>> = {},
): never {
  throw new ServiceError('Development paper refusal.', 'HTTP_ERROR', status, {
    status,
    code,
    messageCode,
    messageArgs: [],
    fieldErrors,
  });
}

interface Holding {
  free: string;
  locked: string;
}

const symbolOf = (pairId: string) =>
  Object.entries(DEV_PAIR_IDS).find(([, id]) => id === pairId)?.[0];

/**
 * DEVELOPMENT ONLY. An in-memory demo exchange with the backend's answers
 * (TR-04, TR-06, TR-07 on its demo trading branch): the account opens
 * once with the Q-T5 grant; MARKET orders fill at the development last
 * price as taker; a LIMIT that crosses fills at once, otherwise it waits,
 * locks its funds and fills as maker when the price reaches it (checked
 * every second); IOC / FOK that cannot fill expire. Fees are the default
 * 0.1 % taken in the asset received. Refusals use the backend's codes:
 * MSG44, MSG41, MSG01 / MSG15 field errors, PAPER_INSUFFICIENT_BALANCE,
 * PAPER_ORDER_NOT_OPEN (MSG43). A reload starts again.
 */
export function createDevelopmentPaperTrading(
  session: () => Promise<Session | null>,
  market: MarketService,
  now: () => number = Date.now,
): { paperTrading: PaperTradingService } {
  let account: PaperAccount | null = null;
  const wallets: Record<PaperWalletType, Map<string, Holding>> = {
    SPOT: new Map(),
    FUTURES: new Map(),
  };
  const orders = new Map<string, PaperOrder>();
  const fills: PaperFill[] = [];
  const transfers = new Map<string, PaperTransfer>();
  let sequence = 0;
  let matcher: ReturnType<typeof setInterval> | undefined;
  const id = (prefix: string) => `${prefix}-${(++sequence).toString(16)}`;
  const at = () => new Date(now()).toISOString();

  const signedIn = async () => {
    if (!(await session())) refuse(401, 'AUTHENTICATION_REQUIRED', 'MSG44');
  };
  const opened = async () => {
    await signedIn();
    if (!account) refuse(404, 'RESOURCE_NOT_FOUND', 'MSG41');
  };
  const holding = (wallet: PaperWalletType, asset: string) => {
    let row = wallets[wallet].get(asset);
    if (!row) {
      row = { free: '0', locked: '0' };
      wallets[wallet].set(asset, row);
    }
    return row;
  };
  const lastPrice = async (symbol: string) => {
    const ticker = await market.getTicker('spot', symbol);
    if (!ticker?.lastPrice) refuse(503, 'PRICE_UNAVAILABLE', 'MSG43');
    return ticker.lastPrice;
  };
  const pairOf = (pairId: string): MarketPair => {
    const symbol = symbolOf(pairId);
    const pair = devPairs('spot').find((each) => each.symbol === symbol);
    if (!pair) refuse(404, 'RESOURCE_NOT_FOUND', 'MSG41');
    return pair;
  };

  /** One execution: moves the funds, takes the fee in the asset received. */
  function execute(
    order: PaperOrder,
    pair: MarketPair,
    price: string,
    quantity: string,
    liquidity: 'MAKER' | 'TAKER',
    lockedQuote: string,
  ) {
    const base = pair.baseAsset ?? pair.symbol;
    const quote = multiply(price, quantity);
    const buy = order.side === 'BUY';
    const received = buy ? quantity : quote;
    const fee = toStep(multiply(received, FEE_RATE), '0.00000001', 'up');
    const quoteRow = holding('SPOT', QUOTE);
    const baseRow = holding('SPOT', base);
    if (buy) {
      // The lock covered the limit price; what it did not spend comes back.
      quoteRow.locked = subtract(quoteRow.locked, lockedQuote);
      quoteRow.free = add(quoteRow.free, subtract(lockedQuote, quote));
      baseRow.free = add(baseRow.free, subtract(quantity, fee));
    } else {
      baseRow.locked = subtract(baseRow.locked, quantity);
      quoteRow.free = add(quoteRow.free, subtract(quote, fee));
    }
    fills.unshift({
      fillId: id('fill'),
      orderId: order.orderId,
      pairId: order.pairId,
      symbol: order.symbol,
      market: 'spot',
      side: order.side,
      price,
      quantity,
      quoteAmount: quote,
      fee,
      feeAsset: buy ? base : QUOTE,
      liquidity,
      source: 'LIVE',
      tradedAt: at(),
    });
    const filled = {
      ...order,
      executedQuantity: quantity,
      cumQuote: quote,
      avgPrice: price,
      status: 'FILLED' as const,
      closedAt: at(),
    };
    orders.set(order.orderId, filled);
    return filled;
  }

  const crosses = (side: OrderSide, limit: string, last: string) =>
    side === 'BUY' ? compare(limit, last) >= 0 : compare(limit, last) <= 0;

  /** Waiting LIMIT orders fill as maker once the price reaches them. */
  const match = async () => {
    const waiting = [...orders.values()].filter((o) => o.status === 'NEW');
    if (waiting.length === 0) {
      clearInterval(matcher);
      matcher = undefined;
      return;
    }
    for (const order of waiting) {
      const pair = pairOf(order.pairId);
      const last = await lastPrice(order.symbol);
      const price = order.price as string;
      if (crosses(order.side, price, last) && order.quantity)
        execute(order, pair, price, order.quantity, 'MAKER', lockOf(order));
    }
  };
  const lockOf = (order: PaperOrder) =>
    order.side === 'BUY'
      ? multiply(order.price as string, order.quantity as string)
      : (order.quantity as string);

  const page = <T>(
    rows: readonly T[],
    query: { page: number; pageSize: number },
  ): PaperPage<T> => ({
    items: rows.slice(
      (query.page - 1) * query.pageSize,
      query.page * query.pageSize,
    ),
    page: query.page,
    pageSize: query.pageSize,
    total: rows.length,
  });

  const paperTrading: PaperTradingService = {
    async openAccount() {
      await signedIn();
      if (!account) {
        account = {
          accountId: 'dev-paper-account-1',
          positionMode: 'one-way',
          openedAt: at(),
        };
        for (const wallet of ['SPOT', 'FUTURES'] as const)
          for (const [asset, amount] of Object.entries(GRANT[wallet]))
            holding(wallet, asset).free = amount;
      }
      return account;
    },

    async getWallet(wallet, signal) {
      signal?.throwIfAborted();
      await opened();
      const btc = await lastPrice('BTCUSDT');
      const balances: PaperBalance[] = [];
      for (const [asset, row] of wallets[wallet]) {
        const total = add(row.free, row.locked);
        const usdtValue =
          asset === QUOTE
            ? total
            : multiply(total, await lastPrice(asset + QUOTE));
        balances.push({
          coinId: 'dev-coin-' + asset,
          asset,
          free: row.free,
          locked: row.locked,
          total,
          usdtValue: toStep(usdtValue, '0.00000001', 'down'),
        });
      }
      balances.sort((a, b) => compare(b.usdtValue ?? '0', a.usdtValue ?? '0'));
      const estimatedUsdt = balances.reduce(
        (sum, row) => add(sum, row.usdtValue ?? '0'),
        '0',
      );
      return {
        wallet,
        balances,
        estimatedUsdt: toStep(estimatedUsdt, '0.00000001', 'down'),
        estimatedBtc: divide(estimatedUsdt, btc, 8),
        complete: true,
      };
    },

    async transfer({ asset, from, amount, clientTransferId }) {
      await opened();
      const earlier = transfers.get(clientTransferId);
      if (earlier) return earlier;
      if (!isPositive(amount))
        refuse(400, 'VALIDATION', 'MSG15', { amount: 'MSG15' });
      const source = holding(from, asset);
      if (compare(source.free, amount) < 0)
        refuse(400, 'PAPER_INSUFFICIENT_BALANCE', 'MSG01');
      const to: PaperWalletType = from === 'SPOT' ? 'FUTURES' : 'SPOT';
      source.free = subtract(source.free, amount);
      const target = holding(to, asset);
      target.free = add(target.free, amount);
      const transfer = {
        transferId: id('transfer'),
        clientTransferId,
        asset,
        from,
        to,
        amount,
        transferredAt: at(),
      };
      transfers.set(clientTransferId, transfer);
      return transfer;
    },

    async placeOrder(request: PlacePaperOrder) {
      await opened();
      const earlier = [...orders.values()].find(
        (order) => order.clientOrderId === request.clientOrderId,
      );
      if (earlier) return earlier;
      const pair = pairOf(request.pairId);
      const tick = pair.tickSize ?? '0.01';
      const step = pair.stepSize ?? '0.00001';
      const limit = request.type === 'LIMIT';
      const errors: Record<string, string> = {};
      if (limit && !request.price) errors.price = 'MSG01';
      if (
        !request.quantity &&
        !(request.side === 'BUY' && request.quoteOrderQty)
      )
        errors.quantity = 'MSG01';
      if (Object.keys(errors).length)
        refuse(400, 'VALIDATION', 'MSG01', errors);
      const last = await lastPrice(pair.symbol);
      const price = limit
        ? toStep(request.price as string, tick, 'half-up')
        : last;
      const quantity = request.quantity
        ? toStep(request.quantity, step, 'down')
        : toStep(divide(request.quoteOrderQty as string, last), step, 'down');
      const notional = multiply(price, quantity);
      if (
        !isPositive(quantity) ||
        compare(notional, pair.minNotional ?? '0') < 0
      )
        refuse(400, 'VALIDATION', 'MSG15', { quantity: 'MSG15' });
      const base = pair.baseAsset ?? pair.symbol;
      const buy = request.side === 'BUY';
      const funds = holding('SPOT', buy ? QUOTE : base);
      const need = buy ? notional : quantity;
      if (compare(funds.free, need) < 0)
        refuse(400, 'PAPER_INSUFFICIENT_BALANCE', 'MSG01');
      funds.free = subtract(funds.free, need);
      funds.locked = add(funds.locked, need);
      const order: PaperOrder = {
        orderId: id('order'),
        clientOrderId: request.clientOrderId,
        pairId: request.pairId,
        symbol: pair.symbol,
        market: 'spot',
        side: request.side,
        type: request.type,
        timeInForce: limit ? (request.timeInForce ?? 'GTC') : null,
        price: limit ? price : null,
        quantity: request.quantity ? quantity : null,
        quoteOrderQty: request.quantity
          ? null
          : (request.quoteOrderQty ?? null),
        executedQuantity: '0',
        cumQuote: '0',
        avgPrice: null,
        status: 'NEW',
        statusReason: null,
        placedAt: at(),
        closedAt: null,
      };
      orders.set(order.orderId, order);
      if (!limit || crosses(request.side, price, last))
        return execute(order, pair, last, quantity, 'TAKER', need);
      if (order.timeInForce !== 'GTC') {
        funds.locked = subtract(funds.locked, need);
        funds.free = add(funds.free, need);
        const expired = {
          ...order,
          status: 'EXPIRED' as const,
          statusReason: `${order.timeInForce}_NOT_FILLABLE`,
          closedAt: at(),
        };
        orders.set(order.orderId, expired);
        return expired;
      }
      matcher ??= setInterval(() => void match().catch(() => undefined), 1_000);
      return order;
    },

    async cancelOrder(orderId) {
      await opened();
      const order = orders.get(orderId);
      if (!order) refuse(404, 'RESOURCE_NOT_FOUND', 'MSG41');
      if (order.status !== 'NEW') refuse(409, 'PAPER_ORDER_NOT_OPEN', 'MSG43');
      const pair = pairOf(order.pairId);
      const funds = holding(
        'SPOT',
        order.side === 'BUY' ? QUOTE : (pair.baseAsset ?? pair.symbol),
      );
      const locked = lockOf(order);
      funds.locked = subtract(funds.locked, locked);
      funds.free = add(funds.free, locked);
      const canceled = {
        ...order,
        status: 'CANCELED' as const,
        closedAt: at(),
      };
      orders.set(orderId, canceled);
      return canceled;
    },

    async cancelAll(pairId) {
      await opened();
      const working = [...orders.values()]
        .filter((order) => order.pairId === pairId && order.status === 'NEW')
        .reverse();
      const canceled: PaperOrder[] = [];
      for (const order of working)
        canceled.push(await paperTrading.cancelOrder(order.orderId));
      return canceled;
    },

    async openOrders(pairId, signal) {
      signal?.throwIfAborted();
      await opened();
      return [...orders.values()]
        .filter(
          (order) =>
            order.status === 'NEW' && (!pairId || order.pairId === pairId),
        )
        .reverse();
    },

    async orders(query, signal) {
      signal?.throwIfAborted();
      await opened();
      const rows = [...orders.values()]
        .filter((order) => !query.pairId || order.pairId === query.pairId)
        .reverse();
      return page(rows, query);
    },

    async fills(query, signal) {
      signal?.throwIfAborted();
      await opened();
      return page(
        fills.filter((fill) => !query.pairId || fill.pairId === query.pairId),
        query,
      );
    },
  };

  return { paperTrading };
}
