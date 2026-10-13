import type {
  Decimal,
  MarketPair,
  OrderSide,
  PlacePaperOrder,
} from '../../../types/domain';
import {
  compare,
  divide,
  isPlainDecimal,
  isPositive,
  multiply,
  percentOf,
  toStep,
} from '../../../utils/decimal-math';

/** What the Trader typed; strings as in the inputs. */
export interface SpotOrderDraft {
  side: OrderSide;
  type: 'LIMIT' | 'MARKET';
  timeInForce: 'GTC' | 'IOC' | 'FOK' | 'GTX';
  price: string;
  amount: string;
  total: string;
  /** MARKET BUY: spend `total` instead of buying `amount`. */
  byTotal: boolean;
}

export type SpotOrderField = 'price' | 'amount' | 'total';
export type SpotOrderProblem =
  'required' | 'invalid' | 'belowStep' | 'minNotional' | 'insufficient';

export interface SpotOrderCheck {
  /** The order to send, or null while a field is wrong or missing. */
  order: Omit<PlacePaperOrder, 'pairId' | 'market' | 'clientOrderId'> | null;
  errors: Partial<Record<SpotOrderField, SpotOrderProblem>>;
  /** Price × quantity in the quote asset (an estimate for MARKET). */
  notional: Decimal | null;
}

export interface Funds {
  /** Free quote asset (USDT) and free base asset of the pair. */
  quote: Decimal;
  base: Decimal;
}

const filled = (value: string) => value.trim() !== '';
const valid = (value: string) =>
  isPlainDecimal(value) && isPositive(value.trim());

/**
 * Checks a Spot order the way the exchange form does before sending it:
 * numbers present and positive, price put on the tick (up for a sell,
 * down for a buy, so it never asks more than typed), quantity floored to
 * the step, at least the minimum order value, and enough free balance.
 * A MARKET order uses the last price as an estimate; the backend decides.
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
  const limit = draft.type === 'LIMIT';
  const byTotal = !limit && buy && draft.byTotal;

  let price: Decimal | null = null;
  if (limit) {
    if (!filled(draft.price)) errors.price = 'required';
    else if (!valid(draft.price)) errors.price = 'invalid';
    else price = toStep(draft.price.trim(), tick, buy ? 'down' : 'up');
  } else price = lastPrice;

  let quantity: Decimal | null = null;
  let spend: Decimal | null = null;
  if (byTotal) {
    if (!filled(draft.total)) errors.total = 'required';
    else if (!valid(draft.total)) errors.total = 'invalid';
    else spend = toStep(draft.total.trim(), '0.00000001', 'down');
  } else if (!filled(draft.amount)) errors.amount = 'required';
  else if (!valid(draft.amount)) errors.amount = 'invalid';
  else {
    quantity = toStep(draft.amount.trim(), step, 'down');
    if (!isPositive(quantity)) errors.amount = 'belowStep';
  }

  const notional =
    spend ??
    (price && quantity && isPositive(quantity)
      ? multiply(price, quantity)
      : null);
  const field: SpotOrderField = byTotal ? 'total' : 'amount';
  if (notional && !errors[field]) {
    if (pair.minNotional && compare(notional, pair.minNotional) < 0)
      errors[field] = 'minNotional';
    else if (
      buy
        ? compare(notional, funds.quote) > 0
        : compare(quantity ?? '0', funds.base) > 0
    )
      errors[field] = 'insufficient';
  }

  const ok =
    Object.keys(errors).length === 0 &&
    (byTotal ? spend !== null : quantity !== null) &&
    (!limit || price !== null);
  return {
    order: ok
      ? {
          side: draft.side,
          type: draft.type,
          ...(limit
            ? { timeInForce: draft.timeInForce, price: price as Decimal }
            : {}),
          ...(byTotal
            ? { quoteOrderQty: spend as Decimal }
            : { quantity: quantity as Decimal }),
        }
      : null,
    errors,
    notional,
  };
}

/**
 * The amount (or, for a MARKET buy by total, the total) for a share of
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
    return { amount, total: totalOf(draft, amount, lastPrice) };
  }
  const spend = percentOf(funds.quote, percent, 2);
  if (draft.type === 'MARKET' && draft.byTotal)
    return { amount: draft.amount, total: spend };
  const price =
    draft.type === 'LIMIT' && valid(draft.price)
      ? draft.price.trim()
      : lastPrice;
  if (!price) return { amount: draft.amount, total: spend };
  const amount = toStep(divide(spend, price), step, 'down');
  return { amount, total: totalOf(draft, amount, lastPrice) };
}

/** Price × amount for the total field; empty while either is missing. */
export function totalOf(
  draft: Pick<SpotOrderDraft, 'type' | 'price'>,
  amount: string,
  lastPrice: Decimal | null,
): string {
  const price =
    draft.type === 'LIMIT'
      ? valid(draft.price)
        ? draft.price.trim()
        : null
      : lastPrice;
  if (!price || !valid(amount)) return '';
  return toStep(multiply(price, amount.trim()), '0.01', 'down');
}

/** The amount for a typed total at the order's price, floored to the step. */
export function amountOf(
  draft: Pick<SpotOrderDraft, 'type' | 'price'>,
  total: string,
  pair: MarketPair,
  lastPrice: Decimal | null,
): string {
  const price =
    draft.type === 'LIMIT'
      ? valid(draft.price)
        ? draft.price.trim()
        : null
      : lastPrice;
  if (!price || !valid(total)) return '';
  return toStep(
    divide(total.trim(), price),
    pair.stepSize ?? '0.00000001',
    'down',
  );
}
