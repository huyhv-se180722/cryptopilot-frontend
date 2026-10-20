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
  PaperLedgerEntry,
  PaperOrder,
  PaperOrderList,
  PaperOrderListLeg,
  PaperPage,
  PaperTransfer,
  PaperWalletType,
  PlacePaperOrder,
  Session,
  SpotOrderType,
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
import { DEV_PAIR_IDS } from './fixtures/market';

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
const STOPS: readonly SpotOrderType[] = [
  'STOP_LOSS',
  'STOP_LOSS_LIMIT',
  'TAKE_PROFIT',
  'TAKE_PROFIT_LIMIT',
];
const isStop = (type: string) => (STOPS as readonly string[]).includes(type);
const isMarketStop = (type: string) =>
  type === 'STOP_LOSS' || type === 'TAKE_PROFIT';
/**
 * The side of the price a Spot stop waits on, as the exchange fixes it: a
 * stop loss BUY and a take profit SELL above, the other two below.
 */
const triggersAbove = (type: string, side: OrderSide) =>
  type.startsWith('STOP_LOSS') === (side === 'BUY');

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
 * (TR-04, TR-06, TR-07, TR-09 to TR-12 on its demo trading branch), in the
 * order types of the exchange's Spot API: the account opens once with the
 * Q-T5 grant; MARKET orders fill at the development last price as taker
 * (by quantity, or by a quote amount on either side); a LIMIT that crosses
 * fills at once, otherwise it waits, locks its funds and fills as maker
 * when the price reaches it (checked every second); IOC / FOK that cannot
 * fill expire; a LIMIT_MAKER that would fill at once is refused; GTX is
 * refused on Spot. STOP_LOSS, STOP_LOSS_LIMIT, TAKE_PROFIT and
 * TAKE_PROFIT_LIMIT wait for the last price on the side their type and
 * side fix (a stop already met is refused), or with a trailing delta for
 * the price to come back from its best by the delta; triggered, the
 * market kinds fill at the last price and the limit kinds wait at their
 * price. OCO, OTO and OTOCO lock once per OCO, cancel the other order of
 * an OCO when one fills or triggers, and place the pending part when the
 * working order fills. Fees are the default 0.1 % taken in the asset
 * received. Refusals use the backend's codes. A reload starts again.
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
  /** What each working order holds back; an OCO holds it on one order. */
  const locks = new Map<string, string>();
  /** The best price a trailing stop has tracked since it started. */
  const best = new Map<string, string>();
  const lists = new Map<string, PaperOrderList>();
  const fills: PaperFill[] = [];
  const transfers = new Map<string, PaperTransfer>();
  const ledger: PaperLedgerEntry[] = [];
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
  /** One balance change, newest first, with the total after it. */
  const record = (
    wallet: PaperWalletType,
    asset: string,
    type: PaperLedgerEntry['type'],
    amount: string,
    refType: PaperLedgerEntry['refType'],
    refId: string | null,
  ) => {
    const row = holding(wallet, asset);
    ledger.unshift({
      entryId: id('entry'),
      wallet,
      asset,
      type,
      amount,
      balanceAfter: add(row.free, row.locked),
      refType,
      refId,
      createdAt: at(),
    });
  };
  const within = (time: string, query: { from?: string; to?: string }) =>
    (!query.from || time >= query.from) && (!query.to || time < query.to);
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
  /** The coin an order of `side` locks: the quote for a buy, the base for a sale. */
  const lockedRow = (order: PaperOrder) => {
    const pair = pairOf(order.pairId);
    return holding(
      'SPOT',
      order.side === 'BUY' ? QUOTE : (pair.baseAsset ?? pair.symbol),
    );
  };
  /** What an order needs held back: its price (or stop) × quantity, or the quantity. */
  const needOf = (
    side: OrderSide,
    price: string | null,
    quantity: string,
  ): string =>
    side === 'BUY' ? multiply(price as string, quantity) : quantity;
  const hold = (order: PaperOrder, amount: string) => {
    const row = lockedRow(order);
    if (compare(row.free, amount) < 0)
      refuse(400, 'PAPER_INSUFFICIENT_BALANCE', 'MSG01');
    row.free = subtract(row.free, amount);
    row.locked = add(row.locked, amount);
    locks.set(order.orderId, amount);
  };
  const release = (order: PaperOrder, amount = locks.get(order.orderId)) => {
    if (!amount || !isPositive(amount)) {
      locks.delete(order.orderId);
      return;
    }
    const row = lockedRow(order);
    row.locked = subtract(row.locked, amount);
    row.free = add(row.free, amount);
    locks.delete(order.orderId);
  };
  const end = (
    order: PaperOrder,
    status: PaperOrder['status'],
    reason: string | null = null,
  ) => {
    const ended = { ...order, status, statusReason: reason, closedAt: at() };
    orders.set(order.orderId, ended);
    return ended;
  };
  const role = (order: PaperOrder) =>
    order.clientOrderId.slice(order.clientOrderId.lastIndexOf(':'));
  const legsOf = (listId: string) =>
    [...orders.values()].filter((order) => order.listId === listId);
  const ocoLeg = (order: PaperOrder) =>
    role(order) === ':tp' || role(order) === ':sl';
  /** The group as the backend answers it, its working order first. */
  const listOf = (listId: string): PaperOrderList => {
    const list = lists.get(listId) as PaperOrderList;
    const rank = (order: PaperOrder) =>
      [':w', ':p', ':tp', ':sl'].indexOf(role(order));
    const legs = legsOf(listId).sort((a, b) => rank(a) - rank(b));
    const done = legs.every(
      (leg) => leg.status !== 'NEW' && leg.status !== 'PENDING_NEW',
    );
    const updated = {
      ...list,
      status: done ? ('ALL_DONE' as const) : list.status,
      orders: legs,
    };
    lists.set(listId, updated);
    return updated;
  };

  /**
   * Before an order of an OCO executes or triggers, the other expires; the
   * lock the pair shared passes to this one.
   */
  const resolveOco = (order: PaperOrder) => {
    if (!order.listId || !ocoLeg(order)) return;
    for (const other of legsOf(order.listId)) {
      if (other.orderId === order.orderId || !ocoLeg(other)) continue;
      if (other.status !== 'NEW') continue;
      const shared = locks.get(other.orderId) ?? '0';
      const own = locks.get(order.orderId) ?? '0';
      locks.set(order.orderId, add(own, shared));
      locks.delete(other.orderId);
      end(other, 'EXPIRED', 'OCO_OTHER_EXECUTED');
    }
  };

  /** One execution: moves the funds, takes the fee in the asset received. */
  function execute(
    order: PaperOrder,
    pair: MarketPair,
    price: string,
    quantity: string,
    liquidity: 'MAKER' | 'TAKER',
  ) {
    resolveOco(order);
    const base = pair.baseAsset ?? pair.symbol;
    const quote = multiply(price, quantity);
    const buy = order.side === 'BUY';
    const received = buy ? quantity : quote;
    const fee = toStep(multiply(received, FEE_RATE), '0.00000001', 'up');
    const quoteRow = holding('SPOT', QUOTE);
    const baseRow = holding('SPOT', base);
    const locked = locks.get(order.orderId) ?? '0';
    locks.delete(order.orderId);
    if (buy) {
      // The lock covered the limit price (or the stop); the rest comes back.
      quoteRow.locked = subtract(quoteRow.locked, locked);
      quoteRow.free = add(quoteRow.free, subtract(locked, quote));
      baseRow.free = add(baseRow.free, subtract(quantity, fee));
    } else {
      baseRow.locked = subtract(baseRow.locked, locked);
      baseRow.free = add(baseRow.free, subtract(locked, quantity));
      quoteRow.free = add(quoteRow.free, subtract(quote, fee));
    }
    const fillId = id('fill');
    record('SPOT', QUOTE, 'TRADE', buy ? '-' + quote : quote, 'FILL', fillId);
    record(
      'SPOT',
      base,
      'TRADE',
      buy ? quantity : '-' + quantity,
      'FILL',
      fillId,
    );
    record('SPOT', buy ? base : QUOTE, 'FEE', '-' + fee, 'FILL', fillId);
    fills.unshift({
      fillId,
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
    if (order.listId && role(order) === ':w') activate(order.listId);
    return filled;
  }

  /** The pending part of an OTO or OTOCO, once its working order filled. */
  function activate(listId: string) {
    const pending = legsOf(listId).filter(
      (leg) => leg.status === 'PENDING_NEW',
    );
    if (pending.length === 0) return;
    const need = pending.reduce((most, leg) => {
      const amount = needOf(
        leg.side,
        leg.price ?? leg.stopPrice ?? null,
        leg.quantity as string,
      );
      return compare(amount, most) > 0 ? amount : most;
    }, '0' as string);
    const row = lockedRow(pending[0] as PaperOrder);
    if (compare(row.free, need) < 0) {
      for (const leg of pending) end(leg, 'REJECTED', 'INSUFFICIENT_BALANCE');
      return;
    }
    pending.forEach((leg, index) => {
      const working = { ...leg, status: 'NEW' as const };
      orders.set(leg.orderId, working);
      // An OCO locks once, on its first order.
      if (index === 0) hold(working, need);
    });
    startMatching();
  }

  const crosses = (side: OrderSide, limit: string, last: string) =>
    side === 'BUY' ? compare(limit, last) >= 0 : compare(limit, last) <= 0;

  /** Whether a waiting stop triggers at `last`; a trailing one moves its best. */
  const triggers = (order: PaperOrder, last: string) => {
    const above = triggersAbove(order.type, order.side);
    const met = (stop: string) =>
      above ? compare(last, stop) >= 0 : compare(last, stop) <= 0;
    if (!order.trailingDelta) return met(order.stopPrice as string);
    const tracked = best.get(order.orderId);
    if (tracked === undefined) {
      if (!order.stopPrice || met(order.stopPrice))
        best.set(order.orderId, last);
      return false;
    }
    const sell = order.side === 'SELL';
    if (sell ? compare(last, tracked) > 0 : compare(last, tracked) < 0) {
      best.set(order.orderId, last);
      return false;
    }
    const share = divide(String(order.trailingDelta), '10000', 12);
    const trigger = sell
      ? multiply(tracked, subtract('1', share))
      : multiply(tracked, add('1', share));
    return sell ? compare(last, trigger) <= 0 : compare(last, trigger) >= 0;
  };

  /** Waiting orders fill as maker once the price reaches them; stops trigger. */
  const match = async () => {
    const waiting = [...orders.values()].filter((o) => o.status === 'NEW');
    if (waiting.length === 0) {
      clearInterval(matcher);
      matcher = undefined;
      return;
    }
    for (const order of waiting) {
      if (orders.get(order.orderId)?.status !== 'NEW') continue;
      const pair = pairOf(order.pairId);
      const last = await lastPrice(order.symbol);
      if (isStop(order.type) && !order.triggeredAt) {
        if (!triggers(order, last)) continue;
        resolveOco(order);
        if (isMarketStop(order.type)) {
          execute(order, pair, last, order.quantity as string, 'TAKER');
          continue;
        }
        orders.set(order.orderId, { ...order, triggeredAt: at() });
        continue;
      }
      const price = order.price as string;
      if (crosses(order.side, price, last) && order.quantity)
        execute(order, pair, price, order.quantity, 'MAKER');
    }
  };
  const startMatching = () => {
    matcher ??= setInterval(() => void match().catch(() => undefined), 1_000);
  };

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

  /** A new order of the Spot types, NEW, with the backend's empty fields. */
  const newOrder = (
    fields: Pick<
      PaperOrder,
      'clientOrderId' | 'pairId' | 'symbol' | 'side' | 'type'
    > &
      Partial<PaperOrder>,
  ): PaperOrder => ({
    orderId: id('order'),
    market: 'spot',
    timeInForce: null,
    price: null,
    quantity: null,
    quoteOrderQty: null,
    executedQuantity: '0',
    cumQuote: '0',
    avgPrice: null,
    status: 'NEW',
    statusReason: null,
    placedAt: at(),
    closedAt: null,
    stopPrice: null,
    trailingDelta: null,
    triggeredAt: null,
    listId: null,
    ...fields,
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
          for (const [asset, amount] of Object.entries(GRANT[wallet])) {
            holding(wallet, asset).free = amount;
            record(wallet, asset, 'INITIAL_GRANT', amount, 'ACCOUNT', null);
          }
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
      const transferId = id('transfer');
      record(from, asset, 'TRANSFER', '-' + amount, 'TRANSFER', transferId);
      record(to, asset, 'TRANSFER', amount, 'TRANSFER', transferId);
      const transfer = {
        transferId,
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

    async transfers(query, signal) {
      signal?.throwIfAborted();
      await opened();
      return page([...transfers.values()].reverse(), query);
    },

    async ledger(query, signal) {
      signal?.throwIfAborted();
      await opened();
      return page(
        ledger.filter(
          (entry) =>
            (!query.wallet || entry.wallet === query.wallet) &&
            (!query.type || entry.type === query.type) &&
            within(entry.createdAt, query),
        ),
        query,
      );
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
      const type = request.type;
      const stop = isStop(type);
      const limitKind =
        type === 'LIMIT' ||
        type === 'LIMIT_MAKER' ||
        type === 'STOP_LOSS_LIMIT' ||
        type === 'TAKE_PROFIT_LIMIT';
      const errors: Record<string, string> = {};
      if (limitKind && !request.price) errors.price = 'MSG01';
      if (!request.quantity && !(type === 'MARKET' && request.quoteOrderQty))
        errors.quantity = 'MSG01';
      if (stop && !request.stopPrice && !request.trailingDelta)
        errors.stopPrice = 'MSG01';
      if ((request.timeInForce as string | undefined) === 'GTX')
        errors.timeInForce = 'MSG15';
      if (Object.keys(errors).length)
        refuse(400, 'VALIDATION', 'MSG01', errors);
      const last = await lastPrice(pair.symbol);
      const price = limitKind
        ? toStep(request.price as string, tick, 'half-up')
        : last;
      const stopPrice = request.stopPrice
        ? toStep(request.stopPrice, tick, 'half-up')
        : null;
      if (stop && stopPrice && !request.trailingDelta) {
        const above = triggersAbove(type, request.side);
        if (
          above ? compare(last, stopPrice) >= 0 : compare(last, stopPrice) <= 0
        )
          refuse(409, 'PAPER_ORDER_WOULD_TRIGGER', 'MSG43');
      }
      const quantity = request.quantity
        ? toStep(request.quantity, step, 'down')
        : toStep(divide(request.quoteOrderQty as string, last), step, 'down');
      const sizing = limitKind ? price : (stopPrice ?? last);
      const notional = multiply(sizing, quantity);
      if (
        !isPositive(quantity) ||
        compare(notional, pair.minNotional ?? '0') < 0
      )
        refuse(400, 'VALIDATION', 'MSG15', { quantity: 'MSG15' });
      if (type === 'LIMIT_MAKER' && crosses(request.side, price, last))
        refuse(409, 'PAPER_ORDER_WOULD_TAKE', 'MSG43');
      const order = newOrder({
        clientOrderId: request.clientOrderId,
        pairId: request.pairId,
        symbol: pair.symbol,
        side: request.side,
        type,
        timeInForce:
          type === 'LIMIT' ||
          type === 'STOP_LOSS_LIMIT' ||
          type === 'TAKE_PROFIT_LIMIT'
            ? (request.timeInForce ?? 'GTC')
            : null,
        price: limitKind ? price : null,
        quantity: request.quantity ? quantity : null,
        quoteOrderQty: request.quantity
          ? null
          : (request.quoteOrderQty ?? null),
        stopPrice,
        trailingDelta: request.trailingDelta ?? null,
      });
      hold(order, needOf(request.side, sizing, quantity));
      orders.set(order.orderId, order);
      if (
        type === 'MARKET' ||
        (type === 'LIMIT' && crosses(request.side, price, last))
      )
        return execute(order, pair, last, quantity, 'TAKER');
      if (
        type === 'LIMIT' &&
        (order.timeInForce === 'IOC' || order.timeInForce === 'FOK')
      ) {
        release(order);
        return end(order, 'EXPIRED', 'NOT_FILLABLE_ON_ARRIVAL');
      }
      startMatching();
      return order;
    },

    async placeOrderList(request) {
      await opened();
      const pair = pairOf(request.pairId);
      const last = await lastPrice(pair.symbol);
      const listId = id('list');
      const created: PaperOrder[] = [];
      const leg = (
        suffix: string,
        part: PaperOrderListLeg,
        pending: boolean,
      ) => {
        const order = newOrder({
          clientOrderId: listId + suffix,
          pairId: request.pairId,
          symbol: pair.symbol,
          side: part.side,
          type: part.type,
          timeInForce:
            part.type === 'LIMIT' || part.type.endsWith('_LIMIT')
              ? 'GTC'
              : null,
          price: part.price ?? null,
          quantity: part.quantity,
          stopPrice: part.stopPrice ?? null,
          listId,
          status: pending ? 'PENDING_NEW' : 'NEW',
        });
        created.push(order);
        return order;
      };
      const oco = (pending: boolean) => {
        const legs = request.oco;
        if (!legs) refuse(400, 'VALIDATION', 'MSG01', { oco: 'MSG01' });
        // An OTOCO without a quantity sells what its working buy leaves net
        // of the fee, or what its working sale sold, as the backend does.
        const working = request.working;
        const quantity =
          legs.quantity ??
          (request.type === 'OTOCO' && working
            ? working.side === 'BUY'
              ? toStep(
                  multiply(working.quantity, subtract('1', FEE_RATE)),
                  pair.stepSize ?? '0.00001',
                  'down',
                )
              : working.quantity
            : undefined);
        if (!quantity)
          refuse(400, 'VALIDATION', 'MSG01', { 'oco.quantity': 'MSG01' });
        const sell = legs.side === 'SELL';
        if (
          !pending &&
          (sell
            ? compare(legs.takeProfitPrice, last) <= 0 ||
              compare(legs.stopPrice, last) >= 0
            : compare(legs.takeProfitPrice, last) >= 0 ||
              compare(legs.stopPrice, last) <= 0)
        )
          refuse(400, 'VALIDATION', 'MSG15', {
            'oco.takeProfitPrice': 'MSG15',
          });
        const takeProfit = leg(
          ':tp',
          {
            side: legs.side,
            type: 'LIMIT_MAKER',
            price: legs.takeProfitPrice,
            quantity,
          },
          pending,
        );
        const stop = leg(
          ':sl',
          {
            side: legs.side,
            type: legs.stopLimitPrice ? 'STOP_LOSS_LIMIT' : 'STOP_LOSS',
            ...(legs.stopLimitPrice ? { price: legs.stopLimitPrice } : {}),
            stopPrice: legs.stopPrice,
            quantity,
          },
          pending,
        );
        return [takeProfit, stop] as const;
      };
      lists.set(listId, {
        listId,
        type: request.type,
        status: 'EXECUTING',
        pairId: request.pairId,
        symbol: pair.symbol,
        orders: [],
      });
      if (request.type === 'OCO') {
        const [takeProfit, stop] = oco(false);
        created.forEach((order) => orders.set(order.orderId, order));
        const need = [takeProfit, stop].reduce((most, order) => {
          const amount = needOf(
            order.side,
            order.price ?? order.stopPrice ?? null,
            order.quantity as string,
          );
          return compare(amount, most) > 0 ? amount : most;
        }, '0');
        hold(takeProfit, need);
      } else {
        if (!request.working)
          refuse(400, 'VALIDATION', 'MSG01', { working: 'MSG01' });
        const working = leg(':w', request.working, false);
        if (request.type === 'OTO') {
          if (!request.pending)
            refuse(400, 'VALIDATION', 'MSG01', { pending: 'MSG01' });
          leg(':p', request.pending, true);
        } else oco(true);
        created.forEach((order) => orders.set(order.orderId, order));
        hold(
          working,
          needOf(working.side, working.price, working.quantity as string),
        );
        if (
          working.type === 'LIMIT' &&
          crosses(working.side, working.price as string, last)
        )
          execute(working, pair, last, working.quantity as string, 'TAKER');
      }
      startMatching();
      return listOf(listId);
    },

    async cancelOrder(orderId) {
      await opened();
      const order = orders.get(orderId);
      if (!order) refuse(404, 'RESOURCE_NOT_FOUND', 'MSG41');
      if (order.status !== 'NEW' && order.status !== 'PENDING_NEW')
        refuse(409, 'PAPER_ORDER_NOT_OPEN', 'MSG43');
      if (order.listId) {
        // Cancelling any order of a group cancels the group.
        await paperTrading.cancelOrderList(order.listId);
        return orders.get(orderId) as PaperOrder;
      }
      release(order);
      best.delete(orderId);
      return end(order, 'CANCELED');
    },

    async cancelOrderList(listId) {
      await opened();
      if (!lists.has(listId)) refuse(404, 'RESOURCE_NOT_FOUND', 'MSG41');
      const legs = legsOf(listId).filter(
        (leg) => leg.status === 'NEW' || leg.status === 'PENDING_NEW',
      );
      if (legs.length === 0) refuse(409, 'PAPER_ORDER_NOT_OPEN', 'MSG43');
      for (const leg of legs) {
        release(leg);
        best.delete(leg.orderId);
        end(leg, 'CANCELED');
      }
      return listOf(listId);
    },

    async cancelAll(pairId) {
      await opened();
      const working = [...orders.values()]
        .filter((order) => order.pairId === pairId && order.status === 'NEW')
        .reverse();
      const canceled: PaperOrder[] = [];
      for (const order of working)
        if (orders.get(order.orderId)?.status === 'NEW')
          canceled.push(await paperTrading.cancelOrder(order.orderId));
      return canceled;
    },

    async openOrders(pairId, signal) {
      signal?.throwIfAborted();
      await opened();
      return [...orders.values()]
        .filter(
          (order) =>
            (order.status === 'NEW' || order.status === 'PENDING_NEW') &&
            (!pairId || order.pairId === pairId),
        )
        .reverse();
    },

    async orders(query, signal) {
      signal?.throwIfAborted();
      await opened();
      const rows = [...orders.values()]
        .filter(
          (order) =>
            (!query.pairId || order.pairId === query.pairId) &&
            (!query.status || order.status === query.status) &&
            within(order.placedAt, query),
        )
        .reverse();
      return page(rows, query);
    },

    async fills(query, signal) {
      signal?.throwIfAborted();
      await opened();
      return page(
        fills.filter(
          (fill) =>
            (!query.pairId || fill.pairId === query.pairId) &&
            within(fill.tradedAt, query),
        ),
        query,
      );
    },
  };

  return { paperTrading };
}
