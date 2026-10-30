import type {
  FuturesAccount,
  FuturesAccountEvent,
  FuturesAlgoOrder,
  FuturesCalculation,
  FuturesCalculatorTab,
  FuturesClosedPosition,
  FuturesIncome,
  FuturesLeverageBracket,
  FuturesOrder,
  FuturesOrderWarnings,
  FuturesPosition,
  FuturesSymbolConfig,
  FuturesTrade,
  MarginType,
  PlaceFuturesAlgoOrder,
  PlaceFuturesOrder,
  PositionSide,
} from '../../types/futures';
import type { Decimal } from '../../types/domain';
import { integrationPending } from './errors';
import type { HttpClient } from './http-client';
import type { AccountFeed } from './paper-trading';
import {
  decodeFuturesAccount,
  decodeFuturesAlgoOrder,
  decodeFuturesAlgoOrders,
  decodeFuturesBrackets,
  decodeFuturesCalculation,
  decodeFuturesClosedPositions,
  decodeFuturesIncomes,
  decodeFuturesLeverage,
  decodeFuturesMarginCall,
  decodeFuturesOrder,
  decodeFuturesOrderUpdate,
  decodeFuturesOrders,
  decodeFuturesPositions,
  decodeFuturesSymbolConfig,
  decodeFuturesSymbolConfigs,
  decodeFuturesTrades,
  decodeFuturesWarnings,
  decodePositionMode,
} from './futures-dto';

/** A time window and a row limit of a history read. */
export interface FuturesHistoryQuery {
  symbol?: string;
  startTime?: string;
  endTime?: string;
  limit?: number;
}

/**
 * Paper Futures USDⓈ-M (D-127): the backend's `/paper/futures/**`, named
 * after the exchange's `/fapi`. Each call needs the Futures feature of the
 * Trader's plan.
 */
export interface FuturesTradingService {
  // Settings
  positionMode(signal?: AbortSignal): Promise<boolean>;
  changePositionMode(dualSidePosition: boolean): Promise<boolean>;
  symbolConfig(
    symbol: string,
    signal?: AbortSignal,
  ): Promise<FuturesSymbolConfig>;
  changeLeverage(
    symbol: string,
    leverage: number,
    marginType: MarginType,
  ): Promise<FuturesSymbolConfig>;
  changeMarginType(
    symbol: string,
    marginType: MarginType,
  ): Promise<FuturesSymbolConfig>;
  brackets(
    symbol: string,
    signal?: AbortSignal,
  ): Promise<readonly FuturesLeverageBracket[]>;
  // Orders
  placeOrder(order: PlaceFuturesOrder): Promise<FuturesOrder>;
  orderWarnings(
    order: PlaceFuturesOrder,
    signal?: AbortSignal,
  ): Promise<FuturesOrderWarnings>;
  amendOrder(amend: {
    symbol: string;
    orderId: string;
    side: PlaceFuturesOrder['side'];
    price: Decimal;
    quantity: Decimal;
  }): Promise<FuturesOrder>;
  cancelOrder(symbol: string, orderId: string): Promise<FuturesOrder>;
  cancelAllOrders(symbol: string): Promise<readonly FuturesOrder[]>;
  openOrders(
    symbol: string | null,
    signal?: AbortSignal,
  ): Promise<readonly FuturesOrder[]>;
  allOrders(
    query: FuturesHistoryQuery & { symbol: string },
    signal?: AbortSignal,
  ): Promise<readonly FuturesOrder[]>;
  userTrades(
    query: FuturesHistoryQuery & { symbol: string },
    signal?: AbortSignal,
  ): Promise<readonly FuturesTrade[]>;
  // Conditional orders
  placeAlgoOrder(order: PlaceFuturesAlgoOrder): Promise<FuturesAlgoOrder>;
  cancelAlgoOrder(symbol: string, algoId: string): Promise<FuturesAlgoOrder>;
  openAlgoOrders(
    symbol: string | null,
    signal?: AbortSignal,
  ): Promise<readonly FuturesAlgoOrder[]>;
  allAlgoOrders(
    query: FuturesHistoryQuery & { symbol: string },
    signal?: AbortSignal,
  ): Promise<readonly FuturesAlgoOrder[]>;
  // Positions and account
  positions(
    symbol: string | null,
    signal?: AbortSignal,
  ): Promise<readonly FuturesPosition[]>;
  account(signal?: AbortSignal): Promise<FuturesAccount>;
  adjustMargin(change: {
    symbol: string;
    positionSide: PositionSide;
    amount: Decimal;
    /** 1 adds, 2 takes out. */
    type: 1 | 2;
  }): Promise<Decimal>;
  closePosition(close: {
    symbol: string;
    positionSide?: PositionSide;
    type: 'MARKET' | 'LIMIT';
    price?: Decimal;
    percent?: Decimal;
  }): Promise<readonly FuturesOrder[]>;
  income(
    query: FuturesHistoryQuery & { incomeType?: string },
    signal?: AbortSignal,
  ): Promise<readonly FuturesIncome[]>;
  positionHistory(
    query: FuturesHistoryQuery,
    signal?: AbortSignal,
  ): Promise<readonly FuturesClosedPosition[]>;
  forceOrders(
    query: FuturesHistoryQuery,
    signal?: AbortSignal,
  ): Promise<readonly FuturesOrder[]>;
  calculate(
    tab: FuturesCalculatorTab,
    input: Record<string, unknown>,
  ): Promise<FuturesCalculation>;
  /** The Trader's Futures queues (TR-41, TR-43); a no-op without them. */
  subscribe(listener: (event: FuturesAccountEvent) => void): () => void;
}

const withSignal = (signal?: AbortSignal) => (signal ? { signal } : {});

function queryOf(values: Record<string, string | number | undefined | null>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values))
    if (value !== undefined && value !== null) params.set(key, String(value));
  const query = params.toString();
  return query ? '?' + query : '';
}

const pending = async (): Promise<never> => integrationPending();

/** Paper Futures while no API is configured: every call answers NOT_CONFIGURED. */
export function createPendingFuturesTradingService(): FuturesTradingService {
  return {
    positionMode: pending,
    changePositionMode: pending,
    symbolConfig: pending,
    changeLeverage: pending,
    changeMarginType: pending,
    brackets: pending,
    placeOrder: pending,
    orderWarnings: pending,
    amendOrder: pending,
    cancelOrder: pending,
    cancelAllOrders: pending,
    openOrders: pending,
    allOrders: pending,
    userTrades: pending,
    placeAlgoOrder: pending,
    cancelAlgoOrder: pending,
    openAlgoOrders: pending,
    allAlgoOrders: pending,
    positions: pending,
    account: pending,
    adjustMargin: pending,
    closePosition: pending,
    income: pending,
    positionHistory: pending,
    forceOrders: pending,
    calculate: pending,
    subscribe: () => () => undefined,
  };
}

const BASE = 'paper/futures/';

export function createHttpFuturesTradingService(
  http: HttpClient,
  accountFeed: AccountFeed | null = null,
): FuturesTradingService {
  return {
    positionMode: (signal) =>
      http.request({
        path: BASE + 'positionSide/dual',
        decode: decodePositionMode,
        ...withSignal(signal),
      }),
    changePositionMode: (dualSidePosition) =>
      http.request({
        path: BASE + 'positionSide/dual',
        method: 'POST',
        body: { dualSidePosition },
        decode: decodePositionMode,
      }),
    symbolConfig: async (symbol, signal) => {
      const configs = await http.request({
        path: BASE + 'symbolConfig' + queryOf({ symbol }),
        decode: decodeFuturesSymbolConfigs,
        ...withSignal(signal),
      });
      const found = configs[0];
      if (!found) throw new Error('no settings of ' + symbol);
      return found;
    },
    changeLeverage: (symbol, leverage, marginType) =>
      http.request({
        path: BASE + 'leverage',
        method: 'POST',
        body: { symbol, leverage },
        decode: decodeFuturesLeverage(marginType),
      }),
    changeMarginType: (symbol, marginType) =>
      http.request({
        path: BASE + 'marginType',
        method: 'POST',
        body: { symbol, marginType },
        decode: decodeFuturesSymbolConfig,
      }),
    brackets: (symbol, signal) =>
      http.request({
        path: BASE + 'leverageBracket' + queryOf({ symbol }),
        decode: decodeFuturesBrackets,
        ...withSignal(signal),
      }),
    placeOrder: (order) =>
      http.request({
        path: BASE + 'order',
        method: 'POST',
        body: order,
        decode: decodeFuturesOrder,
      }),
    orderWarnings: (order, signal) =>
      http.request({
        path: BASE + 'order/warnings',
        method: 'POST',
        body: order,
        decode: decodeFuturesWarnings,
        ...withSignal(signal),
      }),
    amendOrder: (amend) =>
      http.request({
        path: BASE + 'order',
        method: 'PUT',
        body: amend,
        decode: decodeFuturesOrder,
      }),
    cancelOrder: (symbol, orderId) =>
      http.request({
        path: BASE + 'order' + queryOf({ symbol, orderId }),
        method: 'DELETE',
        decode: decodeFuturesOrder,
      }),
    cancelAllOrders: (symbol) =>
      http.request({
        path: BASE + 'allOpenOrders' + queryOf({ symbol }),
        method: 'DELETE',
        decode: decodeFuturesOrders,
      }),
    openOrders: (symbol, signal) =>
      http.request({
        path: BASE + 'openOrders' + queryOf({ symbol }),
        decode: decodeFuturesOrders,
        ...withSignal(signal),
      }),
    allOrders: (query, signal) =>
      http.request({
        path: BASE + 'allOrders' + queryOf({ ...query }),
        decode: decodeFuturesOrders,
        ...withSignal(signal),
      }),
    userTrades: (query, signal) =>
      http.request({
        path: BASE + 'userTrades' + queryOf({ ...query }),
        decode: decodeFuturesTrades,
        ...withSignal(signal),
      }),
    placeAlgoOrder: (order) =>
      http.request({
        path: BASE + 'algoOrder',
        method: 'POST',
        body: { algoType: 'CONDITIONAL', ...order },
        decode: decodeFuturesAlgoOrder,
      }),
    cancelAlgoOrder: (symbol, algoId) =>
      http.request({
        path: BASE + 'algoOrder' + queryOf({ symbol, algoId }),
        method: 'DELETE',
        decode: decodeFuturesAlgoOrder,
      }),
    openAlgoOrders: (symbol, signal) =>
      http.request({
        path: BASE + 'openAlgoOrders' + queryOf({ symbol }),
        decode: decodeFuturesAlgoOrders,
        ...withSignal(signal),
      }),
    allAlgoOrders: (query, signal) =>
      http.request({
        path: BASE + 'allAlgoOrders' + queryOf({ ...query }),
        decode: decodeFuturesAlgoOrders,
        ...withSignal(signal),
      }),
    positions: (symbol, signal) =>
      http.request({
        path: BASE + 'positionRisk' + queryOf({ symbol }),
        decode: decodeFuturesPositions,
        ...withSignal(signal),
      }),
    account: (signal) =>
      http.request({
        path: BASE + 'account',
        decode: decodeFuturesAccount,
        ...withSignal(signal),
      }),
    adjustMargin: (change) =>
      http.request({
        path: BASE + 'positionMargin',
        method: 'POST',
        body: change,
        decode: (body) => {
          const amount = (body as { amount?: unknown }).amount;
          return typeof amount === 'string' || typeof amount === 'number'
            ? String(amount)
            : change.amount;
        },
      }),
    closePosition: (close) =>
      http.request({
        path: BASE + 'closePosition',
        method: 'POST',
        body: close,
        decode: decodeFuturesOrders,
      }),
    income: (query, signal) =>
      http.request({
        path: BASE + 'income' + queryOf({ ...query }),
        decode: decodeFuturesIncomes,
        ...withSignal(signal),
      }),
    positionHistory: (query, signal) =>
      http.request({
        path: BASE + 'positionHistory' + queryOf({ ...query }),
        decode: decodeFuturesClosedPositions,
        ...withSignal(signal),
      }),
    forceOrders: (query, signal) =>
      http.request({
        path: BASE + 'forceOrders' + queryOf({ ...query }),
        decode: decodeFuturesOrders,
        ...withSignal(signal),
      }),
    calculate: (tab, input) =>
      http.request({
        path: BASE + 'calculator/' + tab,
        method: 'POST',
        body: input,
        decode: decodeFuturesCalculation,
      }),
    subscribe: (listener) => {
      if (!accountFeed) return () => undefined;
      const stops = [
        accountFeed.subscribeTopic(
          '/user/queue/futures.orders',
          decodeFuturesOrderUpdate,
          ({ order, trades }) => listener({ kind: 'order', order, trades }),
        ),
        accountFeed.subscribeTopic(
          '/user/queue/futures.algo',
          decodeFuturesAlgoOrder,
          (order) => listener({ kind: 'algo', order }),
        ),
        accountFeed.subscribeTopic(
          '/user/queue/futures.account',
          decodeFuturesAccount,
          (account) => listener({ kind: 'account', account }),
        ),
        accountFeed.subscribeTopic(
          '/user/queue/futures.config',
          (body) => body,
          () => listener({ kind: 'config' }),
        ),
        accountFeed.subscribeTopic(
          '/user/queue/futures.marginCall',
          decodeFuturesMarginCall,
          (call) => listener({ kind: 'marginCall', call }),
        ),
      ];
      return () => stops.forEach((stop) => stop());
    },
  };
}
