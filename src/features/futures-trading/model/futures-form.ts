import type { MarketPair } from '../../../types/domain';
import type {
  FuturesAccount,
  FuturesAlgoType,
  FuturesLeverageBracket,
  FuturesPosition,
  FuturesSymbolConfig,
  PlaceFuturesAlgoOrder,
  PlaceFuturesOrder,
  PositionSide,
} from '../../../types/futures';
import {
  compare,
  divide,
  isPlainDecimal,
  isPositive,
  multiply,
  subtract,
  toStep,
} from '../../../utils/decimal-math';
import {
  maxNotionalAtLeverage,
  maxOpenQuantity,
  orderCost,
  type Bracket,
  type Side,
} from './futures-math';

export { maxNotionalAtLeverage };

/** The server's brackets as the arithmetic reads them. */
export function toBrackets(
  brackets: readonly FuturesLeverageBracket[],
): Bracket[] {
  return brackets.map((b) => ({
    bracketNo: b.bracket,
    notionalFloor: b.notionalFloor,
    notionalCap: b.notionalCap,
    maxLeverage: b.initialLeverage,
    maintenanceMarginRate: b.maintMarginRatio,
    maintenanceAmount: b.cum,
  }));
}

/** The forms of the order panel, as the exchange's: Limit, Market and the conditional ones. */
export type FuturesFormType =
  'LIMIT' | 'MARKET' | 'STOP_LIMIT' | 'STOP_MARKET' | 'TRAILING';

export const CONDITIONAL_FORMS = [
  'STOP_LIMIT',
  'STOP_MARKET',
  'TRAILING',
] as const satisfies readonly FuturesFormType[];

export const isConditionalForm = (type: FuturesFormType) =>
  (CONDITIONAL_FORMS as readonly FuturesFormType[]).includes(type);

export interface FuturesDraft {
  type: FuturesFormType;
  price: string;
  /** The trigger of a Stop Limit or Stop Market. */
  stopPrice: string;
  /** The trigger watches the mark price rather than the last one. */
  stopMark: boolean;
  /** A trailing stop's callback, in percent. */
  callbackRate: string;
  /** A trailing stop's activation price; empty to follow from now. */
  activationPrice: string;
  /** The size as typed, in the base asset or in USDT (order value). */
  size: string;
  sizeUnit: 'BASE' | 'QUOTE';
  reduceOnly: boolean;
  timeInForce: 'GTC' | 'IOC' | 'FOK' | 'GTX';
  tpsl: boolean;
  takeProfit: string;
  stopLoss: string;
  tpslMark: boolean;
}

export const EMPTY_DRAFT: FuturesDraft = {
  type: 'LIMIT',
  price: '',
  stopPrice: '',
  stopMark: false,
  callbackRate: '1',
  activationPrice: '',
  size: '',
  sizeUnit: 'BASE',
  reduceOnly: false,
  timeInForce: 'GTC',
  tpsl: false,
  takeProfit: '',
  stopLoss: '',
  tpslMark: false,
};

/** The action of a button: the side and the position side it acts on. */
export interface FuturesAction {
  side: Side;
  positionSide: PositionSide;
  /** Closes a hedge side. */
  closing: boolean;
}

/**
 * The two buttons of the form (plan 12.2): one-way Buy/Long and
 * Sell/Short on BOTH; hedge Open Long/Short or Close Long/Short.
 */
export function actionsOf(
  hedge: boolean,
  closeTab: boolean,
): [FuturesAction, FuturesAction] {
  if (!hedge)
    return [
      { side: 'BUY', positionSide: 'BOTH', closing: false },
      { side: 'SELL', positionSide: 'BOTH', closing: false },
    ];
  return closeTab
    ? [
        { side: 'BUY', positionSide: 'SHORT', closing: true },
        { side: 'SELL', positionSide: 'LONG', closing: true },
      ]
    : [
        { side: 'BUY', positionSide: 'LONG', closing: false },
        { side: 'SELL', positionSide: 'SHORT', closing: false },
      ];
}

export type FuturesField =
  | 'price'
  | 'stopPrice'
  | 'callbackRate'
  | 'activationPrice'
  | 'size'
  | 'takeProfit'
  | 'stopLoss';

const positiveDecimal = (value: string) =>
  isPlainDecimal(value) && isPositive(value);

/** What the form refuses before sending; the server checks the rest. */
export function checkDraft(
  draft: FuturesDraft,
): Partial<Record<FuturesField, 'required' | 'invalid'>> {
  const errors: Partial<Record<FuturesField, 'required' | 'invalid'>> = {};
  const positive = (field: FuturesField, value: string, required: boolean) => {
    if (value.trim() === '') {
      if (required) errors[field] = 'required';
    } else if (!positiveDecimal(value)) errors[field] = 'invalid';
  };
  if (draft.type === 'LIMIT' || draft.type === 'STOP_LIMIT')
    positive('price', draft.price, true);
  if (draft.type === 'STOP_LIMIT' || draft.type === 'STOP_MARKET')
    positive('stopPrice', draft.stopPrice, true);
  if (draft.type === 'TRAILING') {
    positive('callbackRate', draft.callbackRate, true);
    if (
      !errors.callbackRate &&
      (compare(draft.callbackRate, '0.1') < 0 ||
        compare(draft.callbackRate, '20') > 0)
    )
      errors.callbackRate = 'invalid';
    positive('activationPrice', draft.activationPrice, false);
  }
  positive('size', draft.size, true);
  if (draft.tpsl) {
    positive('takeProfit', draft.takeProfit, false);
    positive('stopLoss', draft.stopLoss, false);
  }
  return errors;
}

/** The signed size of the position an action trades against. */
export function positionSize(
  positions: readonly FuturesPosition[] | undefined,
  symbol: string,
  positionSide: PositionSide,
): string {
  return (
    positions?.find(
      (p) => p.symbol === symbol && p.positionSide === positionSide,
    )?.positionAmt ?? '0'
  );
}

/**
 * The balance an opening order is paid from (4.7, 4.8): available for a
 * cross pair, the cross wallet's free cash for an isolated one, which is
 * what can be withdrawn.
 */
export function budgetOf(
  account: FuturesAccount | undefined,
  config: FuturesSymbolConfig | undefined,
): string | null {
  if (!account || !config) return null;
  return config.marginType === 'CROSSED'
    ? account.availableBalance
    : account.maxWithdrawAmount;
}

export interface Prices {
  last: string | null;
  mark: string | null;
}

/**
 * The limit price the form's order is costed at: its own for a Limit or a
 * Stop Limit, the trigger for a Stop Market (the price it starts at);
 * null for a market order, costed at the last price.
 */
export function costPriceOf(draft: FuturesDraft): string | null {
  const ok = (value: string) => (positiveDecimal(value) ? value : null);
  switch (draft.type) {
    case 'LIMIT':
    case 'STOP_LIMIT':
      return ok(draft.price);
    case 'STOP_MARKET':
      return ok(draft.stopPrice);
    default:
      return null;
  }
}

/** The price a size in USDT is turned into a quantity at. */
export function referencePriceOf(
  draft: FuturesDraft,
  prices: Prices,
): string | null {
  return costPriceOf(draft) ?? prices.last ?? prices.mark;
}

/** The quantity of the order in the base asset, down to the step; null while not known. */
export function quantityOf(
  draft: FuturesDraft,
  pair: MarketPair,
  prices: Prices,
): string | null {
  if (!positiveDecimal(draft.size)) return null;
  if (draft.sizeUnit === 'BASE') return draft.size;
  const reference = referencePriceOf(draft, prices);
  if (!reference || !pair.stepSize) return null;
  const quantity = toStep(
    divide(draft.size, reference, 18),
    pair.stepSize,
    'down',
  );
  return isPositive(quantity) ? quantity : null;
}

/** The Cost and Max (in the base asset) under a button (4.6, 4.8); null while not known. */
export function costAndMax(
  action: FuturesAction,
  draft: FuturesDraft,
  pair: MarketPair,
  prices: Prices,
  config: FuturesSymbolConfig | undefined,
  account: FuturesAccount | undefined,
  brackets: readonly Bracket[] | undefined,
  size: string,
): { cost: string | null; max: string | null } {
  const budget = budgetOf(account, config);
  const last = prices.last ?? prices.mark;
  const mark = prices.mark ?? prices.last;
  const limit = costPriceOf(draft);
  const needsPrice =
    draft.type === 'LIMIT' ||
    draft.type === 'STOP_LIMIT' ||
    draft.type === 'STOP_MARKET';
  if (!config || !last || !mark || (needsPrice && !limit))
    return { cost: null, max: null };
  const short = size.startsWith('-');
  const held = size.replace('-', '');
  const opposite =
    isPositive(held) &&
    ((action.side === 'BUY' && short) || (action.side === 'SELL' && !short));
  let max: string | null = null;
  if (action.closing) max = held;
  else if (budget && brackets && pair.stepSize)
    max = maxOpenQuantity(
      action.side,
      limit,
      last,
      mark,
      config.leverage,
      budget,
      size,
      maxNotionalAtLeverage(brackets, config.leverage),
      pair.stepSize,
    );
  const quantity = quantityOf(draft, pair, prices);
  let cost: string | null = null;
  if (quantity && !action.closing && !draft.reduceOnly) {
    const closable = opposite ? held : '0';
    const opening =
      compare(quantity, closable) > 0 ? subtract(quantity, closable) : '0';
    cost = isPositive(opening)
      ? orderCost(action.side, opening, limit, last, mark, config.leverage)
      : '0';
  } else if (quantity) cost = '0';
  return { cost, max };
}

/** A quantity in the unit the form shows: the base asset, or its value in USDT. */
export function inUnit(
  quantity: string,
  draft: FuturesDraft,
  prices: Prices,
): string | null {
  if (draft.sizeUnit === 'BASE') return quantity;
  const reference = referencePriceOf(draft, prices);
  return reference ? multiply(quantity, reference) : null;
}

/** The MARKET or LIMIT order of the form, for one of its buttons. */
export function orderOf(
  action: FuturesAction,
  draft: FuturesDraft,
  symbol: string,
  quantity: string,
): PlaceFuturesOrder {
  const order: PlaceFuturesOrder = {
    symbol,
    side: action.side,
    positionSide: action.positionSide,
    type: draft.type === 'MARKET' ? 'MARKET' : 'LIMIT',
    quantity,
  };
  if (draft.type === 'LIMIT') {
    order.price = draft.price;
    order.timeInForce = draft.timeInForce;
  }
  if (draft.reduceOnly && action.positionSide === 'BOTH')
    order.reduceOnly = true;
  if (draft.tpsl && !action.closing && !draft.reduceOnly) {
    if (draft.takeProfit) order.takeProfitPrice = draft.takeProfit;
    if (draft.stopLoss) order.stopLossPrice = draft.stopLoss;
    if (order.takeProfitPrice || order.stopLossPrice)
      order.tpSlWorkingType = draft.tpslMark ? 'MARK_PRICE' : 'CONTRACT_PRICE';
  }
  return order;
}

/**
 * The conditional order of the form (TR-20), as the exchange's panel sends
 * it: a stop above the watched price is a STOP for a buy and a TAKE_PROFIT
 * for a sell, below it the other way round; the market kinds the same;
 * a trailing stop with its callback and its activation price.
 */
export function algoOrderOf(
  action: FuturesAction,
  draft: FuturesDraft,
  symbol: string,
  quantity: string,
  prices: Prices,
): PlaceFuturesAlgoOrder {
  const workingType = draft.stopMark ? 'MARK_PRICE' : 'CONTRACT_PRICE';
  const watched = (draft.stopMark ? prices.mark : prices.last) ?? prices.last;
  const order: PlaceFuturesAlgoOrder = {
    symbol,
    side: action.side,
    positionSide: action.positionSide,
    type: 'TRAILING_STOP_MARKET',
    quantity,
    workingType,
  };
  if (draft.reduceOnly && action.positionSide === 'BOTH')
    order.reduceOnly = true;
  if (draft.type === 'TRAILING') {
    order.callbackRate = draft.callbackRate;
    if (positiveDecimal(draft.activationPrice))
      order.activatePrice = draft.activationPrice;
    return order;
  }
  const above = watched ? compare(draft.stopPrice, watched) > 0 : true;
  const stop = action.side === 'BUY' ? above : !above;
  const market = draft.type === 'STOP_MARKET';
  const type: FuturesAlgoType = stop
    ? market
      ? 'STOP_MARKET'
      : 'STOP'
    : market
      ? 'TAKE_PROFIT_MARKET'
      : 'TAKE_PROFIT';
  order.type = type;
  order.triggerPrice = draft.stopPrice;
  if (!market) {
    order.price = draft.price;
    order.timeInForce = draft.timeInForce === 'GTX' ? 'GTC' : draft.timeInForce;
  }
  return order;
}
