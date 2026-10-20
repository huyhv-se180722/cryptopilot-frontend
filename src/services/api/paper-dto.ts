import type {
  MarketType,
  PaperAccount,
  PaperBalance,
  PaperBalanceUpdate,
  PaperFill,
  PaperLedgerEntry,
  PaperOrder,
  PaperOrderList,
  PaperPage,
  PaperTransfer,
  PaperWallet,
  PaperWalletType,
} from '../../types/domain';
import {
  decimal,
  flag,
  instant,
  integer,
  list,
  nullableDecimal,
  nullableInstant,
  nullableText,
  oneOf,
  record,
  text,
} from './decode';

/**
 * Decoders of the backend's demo trading DTOs (`com.cryptopilot.paper`,
 * TR-04, TR-06, TR-07 on its paper branch). Enums keep the backend's
 * names; decimals stay strings; anything else is refused.
 */
const WALLETS = ['SPOT', 'FUTURES'] as const;
const SIDES = ['BUY', 'SELL'] as const;
const TYPES = [
  'MARKET',
  'LIMIT',
  'LIMIT_MAKER',
  'STOP_LOSS',
  'STOP_LOSS_LIMIT',
  'TAKE_PROFIT',
  'TAKE_PROFIT_LIMIT',
  'STOP',
  'STOP_MARKET',
  'TAKE_PROFIT_MARKET',
  'TRAILING_STOP_MARKET',
] as const;
const STATUSES = [
  'NEW',
  'PENDING_NEW',
  'PARTIALLY_FILLED',
  'FILLED',
  'CANCELED',
  'EXPIRED',
  'REJECTED',
] as const;
const TIF = ['GTC', 'IOC', 'FOK', 'GTX'] as const;
const LEDGER_TYPES = [
  'INITIAL_GRANT',
  'TRADE',
  'FEE',
  'REALIZED_PNL',
  'FUNDING_FEE',
  'TRANSFER',
  'LIQUIDATION_FEE',
] as const;
const REF_TYPES = [
  'ORDER',
  'FILL',
  'POSITION',
  'TRANSFER',
  'FUNDING',
  'ACCOUNT',
] as const;

const marketOf = (value: unknown): MarketType =>
  oneOf(['SPOT', 'FUTURES'] as const, value, 'market') === 'SPOT'
    ? 'spot'
    : 'futures';
const walletOf = (value: unknown, name: string): PaperWalletType =>
  oneOf(WALLETS, value, name);

export function decodeAccount(body: unknown): PaperAccount {
  const value = record(body);
  return {
    accountId: text(value.accountId, 'accountId'),
    positionMode:
      oneOf(
        ['ONE_WAY', 'HEDGE'] as const,
        value.positionMode,
        'positionMode',
      ) === 'ONE_WAY'
        ? 'one-way'
        : 'hedge',
    openedAt: instant(value.openedAt, 'openedAt'),
  };
}

function decodeBalance(item: unknown): PaperBalance {
  const value = record(item, 'balance');
  return {
    coinId: text(value.coinId, 'coinId'),
    asset: text(value.asset, 'asset'),
    free: decimal(value.free, 'free'),
    locked: decimal(value.locked, 'locked'),
    total: decimal(value.total, 'total'),
    usdtValue: nullableDecimal(value.usdtValue, 'usdtValue'),
  };
}

/** A `/user/queue/balances` push (TR-08). */
export function decodeBalanceUpdate(body: unknown): PaperBalanceUpdate {
  const value = record(body, 'balance');
  return {
    wallet: walletOf(value.wallet, 'wallet'),
    coinId: text(value.coinId, 'coinId'),
    asset: text(value.asset, 'asset'),
    free: decimal(value.free, 'free'),
    locked: decimal(value.locked, 'locked'),
    total: decimal(value.total, 'total'),
  };
}

export function decodeWallet(body: unknown): PaperWallet {
  const value = record(body);
  return {
    wallet: walletOf(value.wallet, 'wallet'),
    balances: list(value.balances, 'balances').map(decodeBalance),
    estimatedUsdt: decimal(value.estimatedUsdt, 'estimatedUsdt'),
    estimatedBtc: nullableDecimal(value.estimatedBtc, 'estimatedBtc'),
    complete: flag(value.complete, 'complete'),
  };
}

export function decodeTransfer(body: unknown): PaperTransfer {
  const value = record(body, 'transfer');
  return {
    transferId: text(value.transferId, 'transferId'),
    clientTransferId: text(value.clientTransferId, 'clientTransferId'),
    asset: text(value.asset, 'asset'),
    from: walletOf(value.from, 'from'),
    to: walletOf(value.to, 'to'),
    amount: decimal(value.amount, 'amount'),
    transferredAt: instant(value.transferredAt, 'transferredAt'),
  };
}

export function decodeOrder(body: unknown): PaperOrder {
  const value = record(body, 'order');
  return {
    orderId: text(value.orderId, 'orderId'),
    clientOrderId: text(value.clientOrderId, 'clientOrderId'),
    pairId: text(value.pairId, 'pairId'),
    symbol: text(value.symbol, 'symbol'),
    market: marketOf(value.market),
    side: oneOf(SIDES, value.side, 'side'),
    type: oneOf(TYPES, value.type, 'type'),
    timeInForce:
      value.timeInForce === null || value.timeInForce === undefined
        ? null
        : oneOf(TIF, value.timeInForce, 'timeInForce'),
    price: nullableDecimal(value.price, 'price'),
    quantity: nullableDecimal(value.quantity, 'quantity'),
    quoteOrderQty: nullableDecimal(value.quoteOrderQty, 'quoteOrderQty'),
    executedQuantity: decimal(value.executedQuantity, 'executedQuantity'),
    cumQuote: decimal(value.cumQuote, 'cumQuote'),
    avgPrice: nullableDecimal(value.avgPrice, 'avgPrice'),
    status: oneOf(STATUSES, value.status, 'status'),
    statusReason: nullableText(value.statusReason, 'statusReason'),
    placedAt: instant(value.placedAt, 'placedAt'),
    closedAt: nullableInstant(value.closedAt, 'closedAt'),
    stopPrice: nullableDecimal(value.stopPrice, 'stopPrice'),
    trailingDelta:
      value.trailingDelta === null || value.trailingDelta === undefined
        ? null
        : integer(value.trailingDelta, 'trailingDelta'),
    triggeredAt: nullableInstant(value.triggeredAt, 'triggeredAt'),
    listId: nullableText(value.listId, 'listId'),
  };
}

/** A group of orders (TR-10): OCO, OTO or OTOCO with its orders. */
export function decodeOrderList(body: unknown): PaperOrderList {
  const value = record(body, 'orderList');
  return {
    listId: text(value.listId, 'listId'),
    type: oneOf(['OCO', 'OTO', 'OTOCO'] as const, value.type, 'type'),
    status: oneOf(
      ['EXECUTING', 'ALL_DONE', 'REJECTED'] as const,
      value.status,
      'status',
    ),
    pairId: text(value.pairId, 'pairId'),
    symbol: text(value.symbol, 'symbol'),
    orders: list(value.orders, 'orders').map(decodeOrder),
  };
}

export function decodeFill(body: unknown): PaperFill {
  const value = record(body, 'fill');
  return {
    fillId: text(value.fillId, 'fillId'),
    orderId: text(value.orderId, 'orderId'),
    pairId: text(value.pairId, 'pairId'),
    symbol: text(value.symbol, 'symbol'),
    market: marketOf(value.market),
    side: oneOf(SIDES, value.side, 'side'),
    price: decimal(value.price, 'price'),
    quantity: decimal(value.quantity, 'quantity'),
    quoteAmount: decimal(value.quoteAmount, 'quoteAmount'),
    fee: decimal(value.fee, 'fee'),
    feeAsset: text(value.feeAsset, 'feeAsset'),
    liquidity: oneOf(['MAKER', 'TAKER'] as const, value.liquidity, 'liquidity'),
    source: oneOf(['LIVE', 'REPLAY'] as const, value.source, 'source'),
    tradedAt: instant(value.tradedAt, 'tradedAt'),
  };
}

export function decodeLedgerEntry(body: unknown): PaperLedgerEntry {
  const value = record(body, 'entry');
  return {
    entryId: text(value.entryId, 'entryId'),
    wallet: walletOf(value.wallet, 'wallet'),
    asset: text(value.asset, 'asset'),
    type: oneOf(LEDGER_TYPES, value.type, 'type'),
    amount: decimal(value.amount, 'amount'),
    balanceAfter: decimal(value.balanceAfter, 'balanceAfter'),
    refType:
      value.refType === null || value.refType === undefined
        ? null
        : oneOf(REF_TYPES, value.refType, 'refType'),
    refId: nullableText(value.refId, 'refId'),
    createdAt: instant(value.createdAt, 'createdAt'),
  };
}

/** `PageResponse<T>`: items, page, pageSize, total. */
export function decodePage<T>(
  decodeItem: (item: unknown) => T,
): (body: unknown) => PaperPage<T> {
  return (body) => {
    const value = record(body);
    return {
      items: list(value.items, 'items').map(decodeItem),
      page: integer(value.page, 'page'),
      pageSize: integer(value.pageSize, 'pageSize'),
      total: integer(value.total, 'total'),
    };
  };
}

export const decodeOrders = (body: unknown): readonly PaperOrder[] =>
  list(body, 'orders').map(decodeOrder);
