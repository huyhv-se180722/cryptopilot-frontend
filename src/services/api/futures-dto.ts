import type {
  FuturesAccount,
  FuturesAlgoOrder,
  FuturesCalculation,
  FuturesClosedPosition,
  FuturesIncome,
  FuturesLeverageBracket,
  FuturesMarginCall,
  FuturesOrder,
  FuturesOrderWarnings,
  FuturesPosition,
  FuturesSymbolConfig,
  FuturesTrade,
} from '../../types/futures';
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
 * Decoders of the backend's paper Futures DTOs (`/paper/futures/**`,
 * D-127), whose names are the exchange's. Enums keep the backend's names;
 * decimals stay strings; anything else is refused.
 */
const SIDES = ['BUY', 'SELL'] as const;
const POSITION_SIDES = ['BOTH', 'LONG', 'SHORT'] as const;
const MARGIN_TYPES = ['CROSSED', 'ISOLATED'] as const;
const TIF = ['GTC', 'IOC', 'FOK', 'GTX', 'GTD'] as const;
const ORDER_TYPES = ['LIMIT', 'MARKET'] as const;
const ALGO_TYPES = [
  'STOP',
  'STOP_MARKET',
  'TAKE_PROFIT',
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
const WORKING_TYPES = ['CONTRACT_PRICE', 'MARK_PRICE'] as const;
const DIRECTIONS = ['LONG', 'SHORT'] as const;
const CLOSE_REASONS = [
  'MANUAL',
  'TAKE_PROFIT',
  'STOP_LOSS',
  'LIQUIDATION',
  'REDUCE',
  'SYSTEM',
] as const;
const SEVERITIES = ['INFO', 'WARNING', 'BLOCKING'] as const;

export function decodeFuturesOrder(body: unknown): FuturesOrder {
  const v = record(body);
  return {
    orderId: text(v.orderId, 'orderId'),
    clientOrderId: text(v.clientOrderId, 'clientOrderId'),
    symbol: text(v.symbol, 'symbol'),
    status: oneOf(STATUSES, v.status, 'status'),
    statusReason: nullableText(v.statusReason, 'statusReason'),
    type: oneOf(ORDER_TYPES, v.type, 'type'),
    side: oneOf(SIDES, v.side, 'side'),
    positionSide: oneOf(POSITION_SIDES, v.positionSide, 'positionSide'),
    timeInForce: oneOf(TIF, v.timeInForce, 'timeInForce'),
    price: decimal(v.price, 'price'),
    avgPrice: decimal(v.avgPrice, 'avgPrice'),
    origQty: decimal(v.origQty, 'origQty'),
    executedQty: decimal(v.executedQty, 'executedQty'),
    cumQuote: decimal(v.cumQuote, 'cumQuote'),
    reduceOnly: flag(v.reduceOnly, 'reduceOnly'),
    closePosition: flag(v.closePosition, 'closePosition'),
    goodTillDate: nullableInstant(v.goodTillDate, 'goodTillDate'),
    time: instant(v.time, 'time'),
    updateTime: instant(v.updateTime, 'updateTime'),
  };
}

export const decodeFuturesOrders = (body: unknown) =>
  list(body, 'orders').map(decodeFuturesOrder);

export function decodeFuturesTrade(body: unknown): FuturesTrade {
  const v = record(body);
  return {
    id: text(v.id, 'id'),
    orderId: text(v.orderId, 'orderId'),
    symbol: text(v.symbol, 'symbol'),
    side: oneOf(SIDES, v.side, 'side'),
    positionSide: oneOf(POSITION_SIDES, v.positionSide, 'positionSide'),
    price: decimal(v.price, 'price'),
    qty: decimal(v.qty, 'qty'),
    quoteQty: decimal(v.quoteQty, 'quoteQty'),
    realizedPnl: decimal(v.realizedPnl, 'realizedPnl'),
    commission: decimal(v.commission, 'commission'),
    commissionAsset: text(v.commissionAsset, 'commissionAsset'),
    maker: flag(v.maker, 'maker'),
    buyer: flag(v.buyer, 'buyer'),
    positionId: text(v.positionId, 'positionId'),
    time: instant(v.time, 'time'),
  };
}

export const decodeFuturesTrades = (body: unknown) =>
  list(body, 'trades').map(decodeFuturesTrade);

export function decodeFuturesAlgoOrder(body: unknown): FuturesAlgoOrder {
  const v = record(body);
  return {
    algoId: text(v.algoId, 'algoId'),
    clientAlgoId: text(v.clientAlgoId, 'clientAlgoId'),
    orderType: oneOf(ALGO_TYPES, v.orderType, 'orderType'),
    symbol: text(v.symbol, 'symbol'),
    side: oneOf(SIDES, v.side, 'side'),
    positionSide: oneOf(POSITION_SIDES, v.positionSide, 'positionSide'),
    timeInForce:
      v.timeInForce == null ? null : oneOf(TIF, v.timeInForce, 'timeInForce'),
    quantity: nullableDecimal(v.quantity, 'quantity'),
    algoStatus: text(v.algoStatus, 'algoStatus'),
    statusReason: nullableText(v.statusReason, 'statusReason'),
    actualOrderId: nullableText(v.actualOrderId, 'actualOrderId'),
    triggerPrice: nullableDecimal(v.triggerPrice, 'triggerPrice'),
    price: nullableDecimal(v.price, 'price'),
    workingType: oneOf(WORKING_TYPES, v.workingType, 'workingType'),
    closePosition: flag(v.closePosition, 'closePosition'),
    priceProtect: flag(v.priceProtect, 'priceProtect'),
    reduceOnly: flag(v.reduceOnly, 'reduceOnly'),
    createTime: instant(v.createTime, 'createTime'),
    updateTime: instant(v.updateTime, 'updateTime'),
    triggerTime: nullableInstant(v.triggerTime, 'triggerTime'),
    activatePrice: nullableDecimal(v.activatePrice, 'activatePrice'),
    priceRate: nullableDecimal(v.priceRate, 'priceRate'),
  };
}

export const decodeFuturesAlgoOrders = (body: unknown) =>
  list(body, 'algoOrders').map(decodeFuturesAlgoOrder);

export function decodeFuturesPosition(body: unknown): FuturesPosition {
  const v = record(body);
  return {
    symbol: text(v.symbol, 'symbol'),
    positionSide: oneOf(POSITION_SIDES, v.positionSide, 'positionSide'),
    positionAmt: decimal(v.positionAmt, 'positionAmt'),
    entryPrice: decimal(v.entryPrice, 'entryPrice'),
    breakEvenPrice: decimal(v.breakEvenPrice, 'breakEvenPrice'),
    markPrice: decimal(v.markPrice, 'markPrice'),
    unRealizedProfit: decimal(v.unRealizedProfit, 'unRealizedProfit'),
    liquidationPrice: decimal(v.liquidationPrice, 'liquidationPrice'),
    isolatedMargin: decimal(v.isolatedMargin, 'isolatedMargin'),
    notional: decimal(v.notional, 'notional'),
    isolatedWallet: decimal(v.isolatedWallet, 'isolatedWallet'),
    initialMargin: decimal(v.initialMargin, 'initialMargin'),
    maintMargin: decimal(v.maintMargin, 'maintMargin'),
    positionInitialMargin: decimal(
      v.positionInitialMargin,
      'positionInitialMargin',
    ),
    openOrderInitialMargin: decimal(
      v.openOrderInitialMargin,
      'openOrderInitialMargin',
    ),
    marginType: oneOf(MARGIN_TYPES, v.marginType, 'marginType'),
    leverage: integer(v.leverage, 'leverage'),
    marginRatio: nullableDecimal(v.marginRatio, 'marginRatio'),
    updateTime: instant(v.updateTime, 'updateTime'),
  };
}

export const decodeFuturesPositions = (body: unknown) =>
  list(body, 'positions').map(decodeFuturesPosition);

export function decodeFuturesAccount(body: unknown): FuturesAccount {
  const v = record(body);
  return {
    totalInitialMargin: decimal(v.totalInitialMargin, 'totalInitialMargin'),
    totalMaintMargin: decimal(v.totalMaintMargin, 'totalMaintMargin'),
    totalWalletBalance: decimal(v.totalWalletBalance, 'totalWalletBalance'),
    totalUnrealizedProfit: decimal(
      v.totalUnrealizedProfit,
      'totalUnrealizedProfit',
    ),
    totalMarginBalance: decimal(v.totalMarginBalance, 'totalMarginBalance'),
    totalPositionInitialMargin: decimal(
      v.totalPositionInitialMargin,
      'totalPositionInitialMargin',
    ),
    totalOpenOrderInitialMargin: decimal(
      v.totalOpenOrderInitialMargin,
      'totalOpenOrderInitialMargin',
    ),
    totalCrossWalletBalance: decimal(
      v.totalCrossWalletBalance,
      'totalCrossWalletBalance',
    ),
    totalCrossUnPnl: decimal(v.totalCrossUnPnl, 'totalCrossUnPnl'),
    availableBalance: decimal(v.availableBalance, 'availableBalance'),
    maxWithdrawAmount: decimal(v.maxWithdrawAmount, 'maxWithdrawAmount'),
    marginRatio: nullableDecimal(v.marginRatio, 'marginRatio'),
  };
}

export function decodeFuturesSymbolConfig(body: unknown): FuturesSymbolConfig {
  const v = record(body);
  return {
    symbol: text(v.symbol, 'symbol'),
    marginType: oneOf(MARGIN_TYPES, v.marginType, 'marginType'),
    leverage: integer(v.leverage, 'leverage'),
    maxNotionalValue: decimal(v.maxNotionalValue, 'maxNotionalValue'),
  };
}

export const decodeFuturesSymbolConfigs = (body: unknown) =>
  list(body, 'symbolConfigs').map(decodeFuturesSymbolConfig);

/** `/futures/leverage` answers the leverage and its largest notional only. */
export function decodeFuturesLeverage(
  marginType: FuturesSymbolConfig['marginType'],
) {
  return (body: unknown): FuturesSymbolConfig => {
    const v = record(body);
    return {
      symbol: text(v.symbol, 'symbol'),
      marginType,
      leverage: integer(v.leverage, 'leverage'),
      maxNotionalValue: decimal(v.maxNotionalValue, 'maxNotionalValue'),
    };
  };
}

/** The brackets of the pair asked for, in notional order. */
export function decodeFuturesBrackets(
  body: unknown,
): readonly FuturesLeverageBracket[] {
  return list(record(body).brackets, 'brackets').map((row) => {
    const v = record(row, 'bracket');
    return {
      bracket: integer(v.bracket, 'bracket'),
      initialLeverage: integer(v.initialLeverage, 'initialLeverage'),
      notionalCap: decimal(v.notionalCap, 'notionalCap'),
      notionalFloor: decimal(v.notionalFloor, 'notionalFloor'),
      maintMarginRatio: decimal(v.maintMarginRatio, 'maintMarginRatio'),
      cum: decimal(v.cum, 'cum'),
    };
  });
}

export function decodePositionMode(body: unknown): boolean {
  return flag(record(body).dualSidePosition, 'dualSidePosition');
}

export function decodeFuturesIncome(body: unknown): FuturesIncome {
  const v = record(body);
  return {
    symbol: nullableText(v.symbol, 'symbol'),
    incomeType: text(v.incomeType, 'incomeType'),
    income: decimal(v.income, 'income'),
    asset: text(v.asset, 'asset'),
    info: nullableText(v.info, 'info'),
    time: instant(v.time, 'time'),
    tranId: text(v.tranId, 'tranId'),
  };
}

export const decodeFuturesIncomes = (body: unknown) =>
  list(body, 'income').map(decodeFuturesIncome);

export function decodeFuturesClosedPosition(
  body: unknown,
): FuturesClosedPosition {
  const v = record(body);
  return {
    positionId: text(v.positionId, 'positionId'),
    symbol: text(v.symbol, 'symbol'),
    positionSide: oneOf(POSITION_SIDES, v.positionSide, 'positionSide'),
    direction: oneOf(DIRECTIONS, v.direction, 'direction'),
    marginType: oneOf(MARGIN_TYPES, v.marginType, 'marginType'),
    leverage: integer(v.leverage, 'leverage'),
    maxQuantity: decimal(v.maxQuantity, 'maxQuantity'),
    closedQuantity: decimal(v.closedQuantity, 'closedQuantity'),
    entryPrice: decimal(v.entryPrice, 'entryPrice'),
    avgClosePrice: nullableDecimal(v.avgClosePrice, 'avgClosePrice'),
    realizedPnl: decimal(v.realizedPnl, 'realizedPnl'),
    fundingFee: decimal(v.fundingFee, 'fundingFee'),
    liquidationFee: decimal(v.liquidationFee, 'liquidationFee'),
    netProfit: decimal(v.netProfit, 'netProfit'),
    closeReason:
      v.closeReason == null
        ? null
        : oneOf(CLOSE_REASONS, v.closeReason, 'closeReason'),
    openTime: instant(v.openTime, 'openTime'),
    closeTime: nullableInstant(v.closeTime, 'closeTime'),
  };
}

export const decodeFuturesClosedPositions = (body: unknown) =>
  list(body, 'positionHistory').map(decodeFuturesClosedPosition);

export function decodeFuturesWarnings(body: unknown): FuturesOrderWarnings {
  const v = record(body);
  return {
    cost: decimal(v.cost, 'cost'),
    budget: decimal(v.budget, 'budget'),
    liquidationPrice: decimal(v.liquidationPrice, 'liquidationPrice'),
    warnings: list(v.warnings, 'warnings').map((row) => {
      const w = record(row, 'warning');
      return {
        type: text(w.type, 'type'),
        severity: oneOf(SEVERITIES, w.severity, 'severity'),
        message: text(w.message, 'message'),
      };
    }),
  };
}

export function decodeFuturesCalculation(body: unknown): FuturesCalculation {
  const v = record(body);
  const of = (name: keyof FuturesCalculation) => nullableDecimal(v[name], name);
  return {
    initialMargin: of('initialMargin'),
    pnl: of('pnl'),
    roe: of('roe'),
    targetPrice: of('targetPrice'),
    liquidationPrice: of('liquidationPrice'),
    walletBalance: of('walletBalance'),
    maxQuantity: of('maxQuantity'),
    maxNotional: of('maxNotional'),
    maxPositionAtLeverage: of('maxPositionAtLeverage'),
    openPrice: of('openPrice'),
    quantity: of('quantity'),
  };
}

export function decodeFuturesMarginCall(body: unknown): FuturesMarginCall {
  const v = record(body);
  return {
    symbol: nullableText(v.symbol, 'symbol'),
    marginType: oneOf(MARGIN_TYPES, v.marginType, 'marginType'),
    markPrice: nullableDecimal(v.markPrice, 'markPrice'),
    marginRatio: decimal(v.marginRatio, 'marginRatio'),
    eventTime: instant(v.eventTime, 'eventTime'),
  };
}

/** `/user/queue/futures.orders`: the order and the trades it just made. */
export function decodeFuturesOrderUpdate(body: unknown) {
  const v = record(body);
  return {
    order: decodeFuturesOrder(v.order),
    trades: list(v.trades, 'trades').map(decodeFuturesTrade),
  };
}
