import type {
  Decimal,
  MarketPair,
  OrderSide,
  PlacePaperOrder,
  PlacePaperOrderList,
  SpotOrderType,
} from '../../../types/domain';
import {
  compare,
  divide,
  isPlainDecimal,
  isPositive,
  multiply,
  percentOf,
  subtract,
  toStep,
} from '../../../utils/decimal-math';

/**
 * The order types of the exchange's Spot order panel: Limit (with
 * Post-only and TP/SL), Market, and under Stop the Stop-limit, Stop-market,
 * Trailing Stop and OCO forms.
 */
export type SpotFormType =
  'LIMIT' | 'MARKET' | 'STOP_LIMIT' | 'STOP_MARKET' | 'TRAILING' | 'OCO';

/** What the Trader typed; strings as in the inputs. */
export interface SpotOrderDraft {
  side: OrderSide;
  type: SpotFormType;
  timeInForce: 'GTC' | 'IOC' | 'FOK';
  /** Limit: a LIMIT_MAKER, refused if it would fill at once. */
  postOnly: boolean;
  /** The limit price; for an OCO the take profit price. */
  price: string;
  /** The stop (trigger) price; for a trailing stop the optional activation price. */
  stop: string;
  /** OCO: the stop's limit price; empty for a stop executed at the market. */
  stopLimit: string;
  /** Trailing stop: the delta in percent, 0.1 to 20. */
  trailing: string;
  amount: string;
  total: string;
  /** MARKET: spend (BUY) or receive (SELL) `total` instead of `amount`. */
  byTotal: boolean;
  /** Limit: attach a take profit and a stop loss (an OTOCO). */
  tpsl: boolean;
  takeProfit: string;
  stopLoss: string;
}

export const EMPTY_DRAFT: SpotOrderDraft = {
  side: 'BUY',
  type: 'LIMIT',
  timeInForce: 'GTC',
  postOnly: false,
  price: '',
  stop: '',
  stopLimit: '',
  trailing: '',
  amount: '',
  total: '',
  byTotal: false,
  tpsl: false,
  takeProfit: '',
  stopLoss: '',
};

export type SpotOrderField =
  | 'price'
  | 'stop'
  | 'stopLimit'
  | 'trailing'
  | 'amount'
  | 'total'
  | 'takeProfit'
  | 'stopLoss';
export type SpotOrderProblem =
  | 'required'
  | 'invalid'
  | 'belowStep'
  | 'minNotional'
  | 'insufficient'
  | 'atLastPrice'
  | 'noLastPrice'
  | 'trailingRange'
  | 'priceOrder';

/** What a check sends: one order, or a group (OCO, OTOCO). */
export type SpotOrderRequest =
  | {
      kind: 'order';
      order: Omit<PlacePaperOrder, 'pairId' | 'market' | 'clientOrderId'>;
    }
  | { kind: 'list'; list: Omit<PlacePaperOrderList, 'pairId' | 'market'> };

export interface SpotOrderCheck {
  /** What to send, or null while a field is wrong or missing. */
  request: SpotOrderRequest | null;
  errors: Partial<Record<SpotOrderField, SpotOrderProblem>>;
  /** Price × quantity in the quote asset (an estimate for MARKET). */
  notional: Decimal | null;
}

export interface Funds {
  /** Free quote asset (USDT) and free base asset of the pair. */
  quote: Decimal;
  base: Decimal;
}

/** The fee the exchange takes from what a fill brings in (0.1 %). */
const FEE_RATE = '0.001';

const filled = (value: string) => value.trim() !== '';
const valid = (value: string) =>
  isPlainDecimal(value) && isPositive(value.trim());

/** Whether the form type has a limit price of its own. */
export const hasLimitPrice = (type: SpotFormType) =>
  type === 'LIMIT' ||
  type === 'STOP_LIMIT' ||
  type === 'TRAILING' ||
  type === 'OCO';

/**
 * The exchange's stop type for a trigger on one side of the last price, as
 * its order panel picks it: a stop the price rises to on a buy, or falls to
 * on a sale, is a stop loss; the other two are take profits. Null at the
 * last price itself, where the stop would trigger immediately.
 */
export function stopTypeFor(
  side: OrderSide,
  stop: Decimal,
  last: Decimal,
  limit: boolean,
): SpotOrderType | null {
  const above = compare(stop, last);
  if (above === 0) return null;
  const stopLoss = above > 0 === (side === 'BUY');
  if (stopLoss) return limit ? 'STOP_LOSS_LIMIT' : 'STOP_LOSS';
  return limit ? 'TAKE_PROFIT_LIMIT' : 'TAKE_PROFIT';
}

/** The price an order is valued at: its limit, its stop, or the last price. */
function orderPrice(
  draft: Pick<SpotOrderDraft, 'type' | 'price' | 'stop'>,
  lastPrice: Decimal | null,
): Decimal | null {
  if (hasLimitPrice(draft.type))
    return valid(draft.price) ? draft.price.trim() : null;
  if (draft.type === 'STOP_MARKET')
    return valid(draft.stop) ? draft.stop.trim() : lastPrice;
  return lastPrice;
}

/**
 * Checks a Spot order the way the exchange form does before sending it:
 * numbers present and positive, prices put on the tick (up for a sell,
 * down for a buy, so it never asks more than typed), quantity floored to
 * the step, at least the minimum order value, enough free balance, a stop
 * not at the last price, a trailing delta of 0.1 % to 20 %, and the take
 * profit and stop of an OCO or TP/SL on either side of the price. MARKET
 * orders use the last price as an estimate; the backend decides.
 */
export function checkSpotOrder(
  draft: SpotOrderDraft,
  pair: MarketPair,
  funds: Funds,
  lastPrice: Decimal | null,
): SpotOrderCheck {
  const errors: SpotOrderCheck['errors'] = {};
  const tick = pair.tickSize ?? '0.01';
  const step = pair.stepSize ?? '0.00000001';
  const buy = draft.side === 'BUY';
  const type = draft.type;
  const byTotal = type === 'MARKET' && draft.byTotal;
  const onTick = (value: string) =>
    toStep(value.trim(), tick, buy ? 'down' : 'up');
  const priceOf = (field: SpotOrderField, value: string, required = true) => {
    if (!filled(value)) {
      if (required) errors[field] = 'required';
      return null;
    }
    if (!valid(value)) {
      errors[field] = 'invalid';
      return null;
    }
    return onTick(value);
  };

  const price = hasLimitPrice(type) ? priceOf('price', draft.price) : null;
  const stop =
    type === 'STOP_LIMIT' || type === 'STOP_MARKET' || type === 'OCO'
      ? priceOf('stop', draft.stop)
      : type === 'TRAILING'
        ? priceOf('stop', draft.stop, false)
        : null;
  const stopLimit =
    type === 'OCO' ? priceOf('stopLimit', draft.stopLimit, false) : null;

  let trailingDelta: number | null = null;
  if (type === 'TRAILING') {
    if (!filled(draft.trailing)) errors.trailing = 'required';
    else if (!valid(draft.trailing)) errors.trailing = 'invalid';
    else {
      // Basis points, as the exchange's trailingDelta: 1 % = 100.
      trailingDelta = Math.round(Number(draft.trailing.trim()) * 100);
      if (trailingDelta < 10 || trailingDelta > 2000)
        errors.trailing = 'trailingRange';
    }
  }

  let quantity: Decimal | null = null;
  let amountByTotal: Decimal | null = null;
  if (byTotal) {
    if (!filled(draft.total)) errors.total = 'required';
    else if (!valid(draft.total)) errors.total = 'invalid';
    else amountByTotal = toStep(draft.total.trim(), '0.00000001', 'down');
  } else if (!filled(draft.amount)) errors.amount = 'required';
  else if (!valid(draft.amount)) errors.amount = 'invalid';
  else {
    quantity = toStep(draft.amount.trim(), step, 'down');
    if (!isPositive(quantity)) errors.amount = 'belowStep';
  }

  // The stop types follow from where the stop lies against the last price.
  let stopType: SpotOrderType | null = null;
  if ((type === 'STOP_LIMIT' || type === 'STOP_MARKET') && stop) {
    if (!lastPrice) errors.stop = 'noLastPrice';
    else {
      stopType = stopTypeFor(
        draft.side,
        stop,
        lastPrice,
        type === 'STOP_LIMIT',
      );
      if (!stopType) errors.stop = 'atLastPrice';
    }
  }
  if (type === 'TRAILING') {
    if (stop && lastPrice)
      stopType =
        stopTypeFor(draft.side, stop, lastPrice, true) ?? 'STOP_LOSS_LIMIT';
    else if (stop && !lastPrice) errors.stop = 'noLastPrice';
    else stopType = 'STOP_LOSS_LIMIT';
  }
  // An OCO's take profit lies beyond the last price, its stop on this side.
  if (type === 'OCO' && price && stop && lastPrice) {
    const sell = !buy;
    if (sell ? compare(price, lastPrice) <= 0 : compare(price, lastPrice) >= 0)
      errors.price = 'priceOrder';
    if (sell ? compare(stop, lastPrice) >= 0 : compare(stop, lastPrice) <= 0)
      errors.stop = 'priceOrder';
  }

  // TP/SL on a limit: an OCO of the other side, placed once the limit fills.
  let takeProfit: Decimal | null = null;
  let stopLoss: Decimal | null = null;
  const tpsl = type === 'LIMIT' && draft.tpsl;
  if (tpsl) {
    takeProfit = priceOf('takeProfit', draft.takeProfit);
    stopLoss = priceOf('stopLoss', draft.stopLoss);
    if (price && takeProfit && compare(takeProfit, price) * (buy ? 1 : -1) <= 0)
      errors.takeProfit = 'priceOrder';
    if (price && stopLoss && compare(stopLoss, price) * (buy ? 1 : -1) >= 0)
      errors.stopLoss = 'priceOrder';
  }

  const valuedAt =
    price ?? (type === 'STOP_MARKET' ? (stop ?? lastPrice) : lastPrice);
  const notional =
    amountByTotal ??
    (valuedAt && quantity && isPositive(quantity)
      ? multiply(valuedAt, quantity)
      : null);
  const sizeField: SpotOrderField = byTotal ? 'total' : 'amount';
  if (notional && !errors[sizeField]) {
    const ocoNeed =
      type === 'OCO' && buy && stop && quantity
        ? multiply(stopLimit ?? stop, quantity)
        : null;
    const need = ocoNeed && compare(ocoNeed, notional) > 0 ? ocoNeed : notional;
    if (pair.minNotional && compare(notional, pair.minNotional) < 0)
      errors[sizeField] = 'minNotional';
    else if (
      buy
        ? !(type === 'MARKET' && !byTotal && !lastPrice) &&
          compare(need, funds.quote) > 0
        : byTotal
          ? lastPrice !== null &&
            compare(divide(amountByTotal as string, lastPrice), funds.base) > 0
          : compare(quantity ?? '0', funds.base) > 0
    )
      errors[sizeField] = 'insufficient';
  }

  const ok =
    Object.keys(errors).length === 0 &&
    (byTotal ? amountByTotal !== null : quantity !== null);
  return { request: ok ? requestOf() : null, errors, notional };

  function requestOf(): SpotOrderRequest | null {
    const size = byTotal
      ? { quoteOrderQty: amountByTotal as Decimal }
      : { quantity: quantity as Decimal };
    switch (type) {
      case 'MARKET':
        return {
          kind: 'order',
          order: { side: draft.side, type: 'MARKET', ...size },
        };
      case 'LIMIT': {
        const working = draft.postOnly
          ? {
              side: draft.side,
              type: 'LIMIT_MAKER' as const,
              price: price as Decimal,
            }
          : {
              side: draft.side,
              type: 'LIMIT' as const,
              timeInForce: draft.timeInForce,
              price: price as Decimal,
            };
        if (!tpsl) return { kind: 'order', order: { ...working, ...size } };
        // The coin a buy brings in is less the fee: the TP/SL sells what is left.
        const exit = buy
          ? toStep(
              multiply(quantity as Decimal, subtract('1', FEE_RATE)),
              step,
              'down',
            )
          : (quantity as Decimal);
        return {
          kind: 'list',
          list: {
            type: 'OTOCO',
            working: {
              side: working.side,
              type: working.type,
              price: working.price,
              quantity: quantity as Decimal,
            },
            oco: {
              side: buy ? 'SELL' : 'BUY',
              quantity: exit,
              takeProfitPrice: takeProfit as Decimal,
              stopPrice: stopLoss as Decimal,
            },
          },
        };
      }
      case 'STOP_LIMIT':
        return {
          kind: 'order',
          order: {
            side: draft.side,
            type: stopType as SpotOrderType,
            timeInForce: draft.timeInForce,
            price: price as Decimal,
            stopPrice: stop as Decimal,
            ...size,
          },
        };
      case 'STOP_MARKET':
        return {
          kind: 'order',
          order: {
            side: draft.side,
            type: stopType as SpotOrderType,
            stopPrice: stop as Decimal,
            ...size,
          },
        };
      case 'TRAILING':
        return {
          kind: 'order',
          order: {
            side: draft.side,
            type: stopType as SpotOrderType,
            timeInForce: 'GTC',
            price: price as Decimal,
            trailingDelta: trailingDelta as number,
            ...(stop ? { stopPrice: stop } : {}),
            ...size,
          },
        };
      case 'OCO':
        return {
          kind: 'list',
          list: {
            type: 'OCO',
            oco: {
              side: draft.side,
              quantity: quantity as Decimal,
              takeProfitPrice: price as Decimal,
              stopPrice: stop as Decimal,
              ...(stopLimit ? { stopLimitPrice: stopLimit } : {}),
            },
          },
        };
    }
  }
}

/**
 * The amount (or, for a MARKET order by total, the total) for a share of
 * the free balance, as the exchange's percentage slider fills it.
 */
export function shareOfFunds(
  draft: SpotOrderDraft,
  pair: MarketPair,
  funds: Funds,
  percent: number,
  lastPrice: Decimal | null,
): Pick<SpotOrderDraft, 'amount' | 'total'> {
  const step = pair.stepSize ?? '0.00000001';
  const buy = draft.side === 'BUY';
  if (!buy) {
    const amount = toStep(percentOf(funds.base, percent, 12), step, 'down');
    if (draft.type === 'MARKET' && draft.byTotal)
      return {
        amount: draft.amount,
        total: lastPrice
          ? toStep(multiply(amount, lastPrice), '0.01', 'down')
          : draft.total,
      };
    return { amount, total: totalOf(draft, amount, lastPrice) };
  }
  const spend = percentOf(funds.quote, percent, 2);
  if (draft.type === 'MARKET' && draft.byTotal)
    return { amount: draft.amount, total: spend };
  const price = orderPrice(draft, lastPrice);
  if (!price) return { amount: draft.amount, total: spend };
  const amount = toStep(divide(spend, price), step, 'down');
  return { amount, total: totalOf(draft, amount, lastPrice) };
}

/** Price × amount for the total field; empty while either is missing. */
export function totalOf(
  draft: Pick<SpotOrderDraft, 'type' | 'price' | 'stop'>,
  amount: string,
  lastPrice: Decimal | null,
): string {
  const price = orderPrice(draft, lastPrice);
  if (!price || !valid(amount)) return '';
  return toStep(multiply(price, amount.trim()), '0.01', 'down');
}

/** The amount for a typed total at the order's price, floored to the step. */
export function amountOf(
  draft: Pick<SpotOrderDraft, 'type' | 'price' | 'stop'>,
  total: string,
  pair: MarketPair,
  lastPrice: Decimal | null,
): string {
  const price = orderPrice(draft, lastPrice);
  if (!price || !valid(total)) return '';
  return toStep(
    divide(total.trim(), price),
    pair.stepSize ?? '0.00000001',
    'down',
  );
}
