import type { Decimal, ISODateTime } from './domain';

/**
 * Paper Futures USDⓈ-M (D-127, TR-14 … TR-46), with the backend's field
 * names, which are the exchange's (`/fapi`). Decimals stay strings; times
 * are ISO-8601; ids are UUIDs.
 */

export type FuturesSide = 'BUY' | 'SELL';
/** BOTH in one-way mode; LONG or SHORT in hedge mode. */
export type PositionSide = 'BOTH' | 'LONG' | 'SHORT';
export type MarginType = 'CROSSED' | 'ISOLATED';
export type FuturesTimeInForce = 'GTC' | 'IOC' | 'FOK' | 'GTX' | 'GTD';
export type FuturesOrderType = 'LIMIT' | 'MARKET';
export type FuturesAlgoType =
  | 'STOP'
  | 'STOP_MARKET'
  | 'TAKE_PROFIT'
  | 'TAKE_PROFIT_MARKET'
  | 'TRAILING_STOP_MARKET';
export type FuturesOrderStatus =
  | 'NEW'
  | 'PENDING_NEW'
  | 'PARTIALLY_FILLED'
  | 'FILLED'
  | 'CANCELED'
  | 'EXPIRED'
  | 'REJECTED';
/** The price a conditional order watches; CONTRACT_PRICE is the last price. */
export type WorkingType = 'CONTRACT_PRICE' | 'MARK_PRICE';
export type PositionDirection = 'LONG' | 'SHORT';
export type PositionCloseReason =
  'MANUAL' | 'TAKE_PROFIT' | 'STOP_LOSS' | 'LIQUIDATION' | 'REDUCE' | 'SYSTEM';

/** A MARKET or LIMIT order (`/futures/order`). */
export interface FuturesOrder {
  orderId: string;
  clientOrderId: string;
  symbol: string;
  status: FuturesOrderStatus;
  /** Why it ended other than by filling, e.g. MARGIN_INSUFFICIENT. */
  statusReason: string | null;
  type: FuturesOrderType;
  side: FuturesSide;
  positionSide: PositionSide;
  timeInForce: FuturesTimeInForce;
  /** Zero for MARKET. */
  price: Decimal;
  /** Zero before anything executed. */
  avgPrice: Decimal;
  origQty: Decimal;
  executedQty: Decimal;
  cumQuote: Decimal;
  reduceOnly: boolean;
  closePosition: boolean;
  /** GTD only. */
  goodTillDate: ISODateTime | null;
  time: ISODateTime;
  updateTime: ISODateTime;
}

/** One execution (`/futures/userTrades`). */
export interface FuturesTrade {
  id: string;
  orderId: string;
  symbol: string;
  side: FuturesSide;
  positionSide: PositionSide;
  price: Decimal;
  qty: Decimal;
  quoteQty: Decimal;
  realizedPnl: Decimal;
  commission: Decimal;
  commissionAsset: string;
  maker: boolean;
  buyer: boolean;
  positionId: string;
  time: ISODateTime;
}

/** A conditional order (`/futures/algoOrder`). */
export interface FuturesAlgoOrder {
  algoId: string;
  clientAlgoId: string;
  orderType: FuturesAlgoType;
  symbol: string;
  side: FuturesSide;
  positionSide: PositionSide;
  timeInForce: FuturesTimeInForce | null;
  /** Null for closePosition. */
  quantity: Decimal | null;
  /** NEW, TRIGGERED, FINISHED, CANCELED, EXPIRED, REJECTED. */
  algoStatus: string;
  statusReason: string | null;
  /** The order its trigger placed. */
  actualOrderId: string | null;
  triggerPrice: Decimal | null;
  price: Decimal | null;
  workingType: WorkingType;
  closePosition: boolean;
  priceProtect: boolean;
  reduceOnly: boolean;
  createTime: ISODateTime;
  updateTime: ISODateTime;
  triggerTime: ISODateTime | null;
  activatePrice: Decimal | null;
  /** Trailing callback, in percent. */
  priceRate: Decimal | null;
}

/** One open position (`/futures/positionRisk`). */
export interface FuturesPosition {
  symbol: string;
  positionSide: PositionSide;
  /** Signed: positive long, negative short. */
  positionAmt: Decimal;
  entryPrice: Decimal;
  breakEvenPrice: Decimal;
  markPrice: Decimal;
  unRealizedProfit: Decimal;
  /** Zero when no price liquidates it. */
  liquidationPrice: Decimal;
  /** Isolated wallet plus its unrealized profit; zero for cross. */
  isolatedMargin: Decimal;
  notional: Decimal;
  isolatedWallet: Decimal;
  initialMargin: Decimal;
  maintMargin: Decimal;
  positionInitialMargin: Decimal;
  openOrderInitialMargin: Decimal;
  marginType: MarginType;
  leverage: number;
  /** Maintenance over margin balance; null past liquidation. */
  marginRatio: Decimal | null;
  updateTime: ISODateTime;
}

/** The Futures account (`/futures/account`), also pushed on change. */
export interface FuturesAccount {
  totalInitialMargin: Decimal;
  totalMaintMargin: Decimal;
  totalWalletBalance: Decimal;
  totalUnrealizedProfit: Decimal;
  totalMarginBalance: Decimal;
  totalPositionInitialMargin: Decimal;
  totalOpenOrderInitialMargin: Decimal;
  totalCrossWalletBalance: Decimal;
  totalCrossUnPnl: Decimal;
  availableBalance: Decimal;
  maxWithdrawAmount: Decimal;
  /** Of the cross positions together; null without any. */
  marginRatio: Decimal | null;
}

/** A pair's settings (`/futures/symbolConfig`, `/futures/leverage`). */
export interface FuturesSymbolConfig {
  symbol: string;
  marginType: MarginType;
  leverage: number;
  /** The largest notional the leverage allows. */
  maxNotionalValue: Decimal;
}

export interface FuturesLeverageBracket {
  bracket: number;
  initialLeverage: number;
  notionalCap: Decimal;
  notionalFloor: Decimal;
  maintMarginRatio: Decimal;
  cum: Decimal;
}

/** One row of the transaction history (`/futures/income`). */
export interface FuturesIncome {
  symbol: string | null;
  /** TRANSFER, REALIZED_PNL, COMMISSION, FUNDING_FEE, INSURANCE_CLEAR, INSURANCE_COVER. */
  incomeType: string;
  income: Decimal;
  asset: string;
  info: string | null;
  time: ISODateTime;
  tranId: string;
}

/** A closed position (`/futures/positionHistory`). */
export interface FuturesClosedPosition {
  positionId: string;
  symbol: string;
  positionSide: PositionSide;
  direction: PositionDirection;
  marginType: MarginType;
  leverage: number;
  maxQuantity: Decimal;
  closedQuantity: Decimal;
  entryPrice: Decimal;
  avgClosePrice: Decimal | null;
  realizedPnl: Decimal;
  fundingFee: Decimal;
  liquidationFee: Decimal;
  netProfit: Decimal;
  closeReason: PositionCloseReason | null;
  openTime: ISODateTime;
  closeTime: ISODateTime | null;
}

export type FuturesWarningSeverity = 'INFO' | 'WARNING' | 'BLOCKING';

export interface FuturesWarning {
  type: string;
  severity: FuturesWarningSeverity;
  message: string;
}

/** The order form's risk check (`/futures/order/warnings`). */
export interface FuturesOrderWarnings {
  cost: Decimal;
  budget: Decimal;
  liquidationPrice: Decimal;
  warnings: readonly FuturesWarning[];
}

/** What a tab of the calculator worked out; the others stay null. */
export interface FuturesCalculation {
  initialMargin: Decimal | null;
  pnl: Decimal | null;
  roe: Decimal | null;
  targetPrice: Decimal | null;
  liquidationPrice: Decimal | null;
  walletBalance: Decimal | null;
  maxQuantity: Decimal | null;
  maxNotional: Decimal | null;
  maxPositionAtLeverage: Decimal | null;
  openPrice: Decimal | null;
  quantity: Decimal | null;
}

export interface FuturesMarginCall {
  symbol: string | null;
  marginType: MarginType;
  markPrice: Decimal | null;
  marginRatio: Decimal;
  eventTime: ISODateTime;
}

/** What the Trader's Futures queues push (TR-41, TR-43). */
export type FuturesAccountEvent =
  | { kind: 'order'; order: FuturesOrder; trades: readonly FuturesTrade[] }
  | { kind: 'algo'; order: FuturesAlgoOrder }
  | { kind: 'account'; account: FuturesAccount }
  | { kind: 'config' }
  | { kind: 'marginCall'; call: FuturesMarginCall };

/** A new MARKET or LIMIT order. */
export interface PlaceFuturesOrder {
  symbol: string;
  side: FuturesSide;
  positionSide?: PositionSide;
  type: FuturesOrderType;
  timeInForce?: FuturesTimeInForce;
  quantity: Decimal;
  price?: Decimal;
  reduceOnly?: boolean;
  newClientOrderId?: string;
  takeProfitPrice?: Decimal;
  stopLossPrice?: Decimal;
  tpSlWorkingType?: WorkingType;
  goodTillDate?: ISODateTime;
}

/** A new conditional order. */
export interface PlaceFuturesAlgoOrder {
  symbol: string;
  side: FuturesSide;
  positionSide?: PositionSide;
  type: FuturesAlgoType;
  timeInForce?: FuturesTimeInForce;
  quantity?: Decimal;
  price?: Decimal;
  triggerPrice?: Decimal;
  workingType?: WorkingType;
  priceProtect?: boolean;
  reduceOnly?: boolean;
  closePosition?: boolean;
  activatePrice?: Decimal;
  callbackRate?: Decimal;
  clientAlgoId?: string;
}

export type FuturesCalculatorTab =
  'pnl' | 'target' | 'liquidation' | 'maxOpen' | 'openPrice';
