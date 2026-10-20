import type { StompTopics } from '../websocket/stomp-market-feed';
import type { FeedStatus, MarketFeed, PaperTradingService } from './contracts';
import type { PaperAccountEvent } from '../../types/domain';
import { integrationPending } from './errors';
import type { HttpClient } from './http-client';
import {
  decodeAccount,
  decodeBalanceUpdate,
  decodeFill,
  decodeLedgerEntry,
  decodeOrder,
  decodeOrderList,
  decodeOrders,
  decodePage,
  decodeTransfer,
  decodeWallet,
} from './paper-dto';

/**
 * Demo trading while it is off (D-101) or no API is configured: every call
 * answers NOT_CONFIGURED.
 */
export function createPendingPaperTradingService(): PaperTradingService {
  return {
    openAccount: async () => integrationPending(),
    getWallet: async () => integrationPending(),
    transfer: async () => integrationPending(),
    transfers: async () => integrationPending(),
    ledger: async () => integrationPending(),
    placeOrder: async () => integrationPending(),
    placeOrderList: async () => integrationPending(),
    cancelOrder: async () => integrationPending(),
    cancelOrderList: async () => integrationPending(),
    cancelAll: async () => integrationPending(),
    openOrders: async () => integrationPending(),
    orders: async () => integrationPending(),
    fills: async () => integrationPending(),
    ...noAccountFeed,
  };
}

/** No push of the account: screens read their data on a rhythm. */
export const noAccountFeed: Pick<
  PaperTradingService,
  'subscribeAccount' | 'accountFeedStatus' | 'onAccountFeedStatus'
> = {
  subscribeAccount: () => () => undefined,
  accountFeedStatus: (): FeedStatus => 'unavailable',
  onAccountFeedStatus: () => () => undefined,
};

/** The signed-in connection the account's queues ride on (TR-08). */
export type AccountFeed = StompTopics & Pick<MarketFeed, 'status' | 'onStatus'>;

/**
 * The three queues of TR-08 on `feed`, one listener for all: orders and
 * fills decode as their REST rows, balances as the moved row.
 */
function accountPushes(feed: AccountFeed | null) {
  if (!feed) return noAccountFeed;
  return {
    subscribeAccount: (listener: (event: PaperAccountEvent) => void) => {
      const stops = [
        feed.subscribeTopic('/user/queue/orders', decodeOrder, (order) =>
          listener({ kind: 'order', order }),
        ),
        feed.subscribeTopic('/user/queue/fills', decodeFill, (fill) =>
          listener({ kind: 'fill', fill }),
        ),
        feed.subscribeTopic(
          '/user/queue/balances',
          decodeBalanceUpdate,
          (balance) => listener({ kind: 'balance', balance }),
        ),
      ];
      return () => stops.forEach((stop) => stop());
    },
    accountFeedStatus: feed.status,
    onAccountFeedStatus: feed.onStatus,
  };
}

const withSignal = (signal?: AbortSignal) => (signal ? { signal } : {});

/** `?a=1&b=x` from the defined values only; empty without any. */
function queryOf(values: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values))
    if (value !== undefined) params.set(key, String(value));
  const query = params.toString();
  return query ? '?' + query : '';
}

/**
 * `/paper/**` of the backend's demo trading module (TR-04, TR-06, TR-07),
 * with the bearer token (Trader only). Used only while demo trading is on
 * (D-101), that is against a backend that has the module (D-104). Enums go
 * upper case, decimals as strings; every response is decoded.
 */
export function createHttpPaperTradingService(
  http: HttpClient,
  accountFeed: AccountFeed | null = null,
): PaperTradingService {
  return {
    ...accountPushes(accountFeed),
    openAccount: () =>
      http.request({
        path: 'paper/account',
        method: 'POST',
        decode: decodeAccount,
      }),
    getWallet: (wallet, signal) =>
      http.request({
        path: 'paper/wallets/' + wallet,
        decode: decodeWallet,
        ...withSignal(signal),
      }),
    transfer: (transfer) =>
      http.request({
        path: 'paper/transfers',
        method: 'POST',
        body: transfer,
        decode: decodeTransfer,
      }),
    transfers: ({ page, pageSize }, signal) =>
      http.request({
        path: 'paper/transfers' + queryOf({ page, pageSize }),
        decode: decodePage(decodeTransfer),
        ...withSignal(signal),
      }),
    ledger: ({ wallet, type, from, to, page, pageSize }, signal) =>
      http.request({
        path:
          'paper/ledger' + queryOf({ wallet, type, from, to, page, pageSize }),
        decode: decodePage(decodeLedgerEntry),
        ...withSignal(signal),
      }),
    placeOrder: ({ market, ...order }) =>
      http.request({
        path: 'paper/orders',
        method: 'POST',
        body: { ...order, market: market.toUpperCase() },
        decode: decodeOrder,
      }),
    placeOrderList: ({ market, ...list }) =>
      http.request({
        path: 'paper/order-lists',
        method: 'POST',
        body: { ...list, market: market.toUpperCase() },
        decode: decodeOrderList,
      }),
    cancelOrder: (orderId) =>
      http.request({
        path: `paper/orders/${encodeURIComponent(orderId)}/cancel`,
        method: 'POST',
        decode: decodeOrder,
      }),
    cancelOrderList: (listId) =>
      http.request({
        path: `paper/order-lists/${encodeURIComponent(listId)}/cancel`,
        method: 'POST',
        decode: decodeOrderList,
      }),
    cancelAll: (pairId) =>
      http.request({
        path: 'paper/orders/open' + queryOf({ pairId }),
        method: 'DELETE',
        decode: decodeOrders,
      }),
    openOrders: (pairId, signal) =>
      http.request({
        path: 'paper/orders/open' + queryOf({ pairId: pairId ?? undefined }),
        decode: decodeOrders,
        ...withSignal(signal),
      }),
    orders: ({ pairId, status, from, to, page, pageSize }, signal) =>
      http.request({
        path:
          'paper/orders' +
          queryOf({ pairId, status, from, to, page, pageSize }),
        decode: decodePage(decodeOrder),
        ...withSignal(signal),
      }),
    fills: ({ pairId, from, to, page, pageSize }, signal) =>
      http.request({
        path: 'paper/fills' + queryOf({ pairId, from, to, page, pageSize }),
        decode: decodePage(decodeFill),
        ...withSignal(signal),
      }),
  };
}
