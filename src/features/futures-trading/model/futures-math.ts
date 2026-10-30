import BigBase, { type Big as BigValue } from 'big.js';

/**
 * The arithmetic of paper Futures USDⓈ-M (plan 4), the same as the
 * backend's `FuturesMarginMath`: both run the shared golden cases
 * (`golden/*.json`, a copy of the backend's `tools/golden/futures`), so the
 * form's Cost, Max and Liq are the numbers the server checks.
 *
 * Strings in, strings out. Amounts round half-even to 8 decimals, prices to
 * 12, a liquidation price to the tick towards the position, a quantity down
 * to the step; divisions inside a calculation keep 40 digits, as the
 * server's DECIMAL128 does.
 */
const Big = BigBase();
Big.DP = 40;
Big.RM = Big.roundHalfEven;
Big.NE = -60;
Big.PE = 60;

const AMOUNT_SCALE = 8;
const PRICE_SCALE = 12;
/** What a MARKET order (and a short LIMIT one) is costed above the last price. */
const MARKET_PRICE_BUFFER = '0.0015';

export type Side = 'BUY' | 'SELL';
export type Direction = 'LONG' | 'SHORT';

/** One leverage bracket; a missing maintenance amount is filled in (BR-27). */
export interface Bracket {
  bracketNo: number;
  notionalFloor: string;
  notionalCap: string;
  maxLeverage: number;
  maintenanceMarginRate: string;
  maintenanceAmount: string | null;
}

interface ResolvedBracket extends Bracket {
  maintenanceAmount: string;
}

const big = (value: string | number | BigValue) => new Big(value);
const amount = (value: BigValue) =>
  value.round(AMOUNT_SCALE, Big.roundHalfEven).toFixed(AMOUNT_SCALE);
const price = (value: BigValue) =>
  value.round(PRICE_SCALE, Big.roundHalfEven).toFixed(PRICE_SCALE);
const signOf = (direction: Direction) => (direction === 'LONG' ? 1 : -1);
export const directionOpenedBy = (side: Side): Direction =>
  side === 'BUY' ? 'LONG' : 'SHORT';

function requirePositive(value: string, name: string) {
  if (!big(value).gt(0)) throw new Error(name + ' must be positive');
}

function requireLeverage(leverage: number) {
  if (!Number.isInteger(leverage) || leverage < 1)
    throw new Error('leverage must be at least 1');
  return leverage;
}

// ---------------------------------------------------------------- brackets

/** The brackets in notional order, each with its maintenance amount. */
export function withMaintenanceAmounts(
  brackets: readonly Bracket[],
): ResolvedBracket[] {
  const sorted = [...brackets].sort((a, b) =>
    big(a.notionalFloor).cmp(b.notionalFloor),
  );
  const resolved: ResolvedBracket[] = [];
  let below: ResolvedBracket | null = null;
  for (const bracket of sorted) {
    const maintenanceAmount: string =
      bracket.maintenanceAmount ??
      (below === null
        ? '0'
        : big(below.maintenanceAmount)
            .plus(
              big(bracket.notionalFloor).times(
                big(bracket.maintenanceMarginRate).minus(
                  below.maintenanceMarginRate,
                ),
              ),
            )
            .toString());
    const next: ResolvedBracket = { ...bracket, maintenanceAmount };
    resolved.push(next);
    below = next;
  }
  return resolved;
}

/** The bracket whose [floor, cap) holds the notional; null above them all. */
export function bracketFor(
  brackets: readonly Bracket[],
  notional: string,
): ResolvedBracket | null {
  const size = big(notional).abs();
  return (
    withMaintenanceAmounts(brackets).find(
      (b) => size.gte(b.notionalFloor) && size.lt(b.notionalCap),
    ) ?? null
  );
}

/** `|notional| × MMR − cum` of its bracket. */
export function maintenanceMargin(
  brackets: readonly Bracket[],
  notional: string,
): string {
  const bracket = bracketFor(brackets, notional);
  if (!bracket) throw new Error('notional is above every bracket');
  return amount(
    big(notional)
      .abs()
      .times(bracket.maintenanceMarginRate)
      .minus(bracket.maintenanceAmount),
  );
}

/** The highest leverage of the pair, bracket 1's. */
export function maxLeverage(brackets: readonly Bracket[]): number {
  const first = withMaintenanceAmounts(brackets)[0];
  if (!first) throw new Error('the pair has no leverage bracket');
  return first.maxLeverage;
}

/** The largest notional a position may reach at a leverage. */
export function maxNotionalAtLeverage(
  brackets: readonly Bracket[],
  leverage: number,
): string {
  let max = big(0);
  for (const b of brackets)
    if (b.maxLeverage >= leverage && big(b.notionalCap).gt(max))
      max = big(b.notionalCap);
  return max.toString();
}

/** `|notional| / L`. */
export function initialMargin(notional: string, leverage: number): string {
  return amount(big(notional).abs().div(requireLeverage(leverage)));
}

// ---------------------------------------------------------------- profit and loss

/** `side × Q × (M − E)`. */
export function unrealizedPnl(
  direction: Direction,
  quantity: string,
  entryPrice: string,
  markPrice: string,
): string {
  return amount(
    big(quantity)
      .times(big(markPrice).minus(entryPrice))
      .times(signOf(direction)),
  );
}

/** ROE in percent, two decimals: `PnL / IM × 100`; zero without margin. */
export function roePercent(pnl: string, margin: string): string {
  if (big(margin).eq(0)) return '0.00';
  return big(pnl).times(100).div(margin).round(2, Big.roundHalfEven).toFixed(2);
}

export interface PositionFill {
  closedQuantity: string;
  realizedPnl: string;
  openedQuantity: string;
  quantityAfter: string;
  /** Null when the fill closed the position. */
  entryPriceAfter: string | null;
}

/** What one fill does to a one-way position of signed size `quantityBefore`. */
export function applyFill(
  quantityBefore: string,
  entryPriceBefore: string | null,
  side: Side,
  quantity: string,
  fillPrice: string,
): PositionFill {
  requirePositive(quantity, 'quantity');
  requirePositive(fillPrice, 'price');
  const fillSign = side === 'BUY' ? 1 : -1;
  const before = big(quantityBefore);
  const size = before.abs();
  const zero = big(0).toFixed(AMOUNT_SCALE);
  if (before.eq(0)) {
    return {
      closedQuantity: '0',
      realizedPnl: zero,
      openedQuantity: quantity,
      quantityAfter: big(quantity).times(fillSign).toString(),
      entryPriceAfter: price(big(fillPrice)),
    };
  }
  if (before.s === fillSign) {
    const entry = size
      .times(entryPriceBefore ?? '0')
      .plus(big(quantity).times(fillPrice))
      .div(size.plus(quantity));
    return {
      closedQuantity: '0',
      realizedPnl: zero,
      openedQuantity: quantity,
      quantityAfter: before.plus(big(quantity).times(fillSign)).toString(),
      entryPriceAfter: price(entry),
    };
  }
  const held = before.gt(0) ? 1 : -1;
  const closed = big(quantity).lt(size) ? big(quantity) : size;
  const realized = amount(
    closed.times(big(fillPrice).minus(entryPriceBefore ?? '0')).times(held),
  );
  const against = big(quantity).cmp(size);
  if (against < 0)
    return {
      closedQuantity: closed.toString(),
      realizedPnl: realized,
      openedQuantity: '0',
      quantityAfter: before.plus(big(quantity).times(fillSign)).toString(),
      entryPriceAfter: entryPriceBefore,
    };
  if (against === 0)
    return {
      closedQuantity: closed.toString(),
      realizedPnl: realized,
      openedQuantity: '0',
      quantityAfter: '0',
      entryPriceAfter: null,
    };
  const opened = big(quantity).minus(size);
  return {
    closedQuantity: closed.toString(),
    realizedPnl: realized,
    openedQuantity: opened.toString(),
    quantityAfter: opened.times(fillSign).toString(),
    entryPriceAfter: price(big(fillPrice)),
  };
}

// ---------------------------------------------------------------- cost and balances

function openLoss(
  sign: number,
  quantity: BigValue,
  markPrice: string,
  at: BigValue,
): BigValue {
  const move = big(markPrice).minus(at).times(sign);
  return quantity.times(move.lt(0) ? move.abs() : 0);
}

/**
 * The cost of opening `quantity` (4.6): the initial margin at the assumed
 * price plus the open loss against the mark. A LIMIT long is costed at its
 * price, a LIMIT short at max(last × 1.0015, mark, price), a MARKET order
 * at last × 1.0015.
 *
 * @param limitPrice null for a MARKET order
 */
export function orderCost(
  side: Side,
  quantity: string,
  limitPrice: string | null,
  lastPrice: string,
  markPrice: string,
  leverage: number,
): string {
  requirePositive(quantity, 'quantity');
  const sign = side === 'BUY' ? 1 : -1;
  const buffered = big(lastPrice).times(big(1).plus(MARKET_PRICE_BUFFER));
  let assuming: BigValue;
  let lossAt: BigValue;
  if (limitPrice === null) {
    assuming = buffered;
    lossAt = buffered;
  } else if (side === 'BUY') {
    assuming = big(limitPrice);
    lossAt = big(limitPrice);
  } else {
    const highest = [buffered, big(markPrice), big(limitPrice)].reduce(
      (a, b) => (a.gt(b) ? a : b),
    );
    assuming = highest;
    lossAt = big(limitPrice);
  }
  const initial = assuming.times(quantity).div(requireLeverage(leverage));
  return amount(initial.plus(openLoss(sign, big(quantity), markPrice, lossAt)));
}

/** What a fill moves into an isolated wallet: `q × P / L + open loss at P`. */
export function isolatedFillMargin(
  direction: Direction,
  quantity: string,
  fillPrice: string,
  markPrice: string,
  leverage: number,
): string {
  const initial = big(quantity).times(fillPrice).div(requireLeverage(leverage));
  return amount(
    initial.plus(
      openLoss(signOf(direction), big(quantity), markPrice, big(fillPrice)),
    ),
  );
}

export interface PendingOrderMargin {
  side: Side;
  quantity: string;
  cost: string;
}

function sideMargin(
  orders: readonly PendingOrderMargin[],
  side: Side,
  closable: BigValue | null,
): BigValue {
  let quantity = big(0);
  let cost = big(0);
  for (const order of orders)
    if (order.side === side) {
      quantity = quantity.plus(order.quantity);
      cost = cost.plus(order.cost);
    }
  if (quantity.eq(0) || closable === null) return cost;
  const opening = quantity.minus(closable);
  return cost.times(opening.gt(0) ? opening : 0).div(quantity);
}

/** The margin of a pair's open orders (4.7): the larger of the two sides. */
export function openOrderInitialMargin(
  positionQuantity: string,
  orders: readonly PendingOrderMargin[],
): string {
  const position = big(positionQuantity);
  const bid = sideMargin(orders, 'BUY', position.lt(0) ? position.abs() : null);
  const ask = sideMargin(orders, 'SELL', position.gt(0) ? position : null);
  return amount(bid.gt(ask) ? bid : ask);
}

export interface AccountMargin {
  availableBalance: string;
  crossFreeCash: string;
  maxWithdrawAmount: string;
}

/** The derived balances of the cross wallet (4.7). */
export function accountMargin(
  crossWalletBalance: string,
  crossUnrealizedPnl: string,
  crossPositionInitialMargin: string,
  openOrderMargin: string,
): AccountMargin {
  const committed = big(crossPositionInitialMargin).plus(openOrderMargin);
  const rawAvailable = big(crossWalletBalance)
    .plus(crossUnrealizedPnl)
    .minus(committed);
  const available = rawAvailable.gt(0) ? rawAvailable : big(0);
  const loss = big(crossUnrealizedPnl).lt(0) ? big(crossUnrealizedPnl) : 0;
  const rawFree = big(crossWalletBalance).minus(committed).plus(loss);
  const free = rawFree.gt(0) ? rawFree : big(0);
  return {
    availableBalance: amount(available),
    crossFreeCash: amount(free),
    maxWithdrawAmount: amount(available.lt(free) ? available : free),
  };
}

/** A quantity down to the step. */
export function toStep(quantity: BigValue | string, stepSize: string): string {
  const places = (stepSize.split('.')[1] ?? '').replace(/0+$/, '').length;
  return big(quantity)
    .div(stepSize)
    .round(0, Big.roundDown)
    .times(stepSize)
    .toFixed(places);
}

/**
 * The largest quantity an order opens with `budget` (4.8), down to the
 * step: its cost fits the budget and the position after it stays within
 * the leverage's largest notional; an opposite position closes first for
 * free.
 */
export function maxOpenQuantity(
  side: Side,
  limitPrice: string | null,
  lastPrice: string,
  markPrice: string,
  leverage: number,
  budget: string,
  positionQuantity: string,
  maxNotional: string,
  stepSize: string,
): string {
  const sign = side === 'BUY' ? 1 : -1;
  const position = big(positionQuantity);
  const opposite = !position.eq(0) && position.s !== sign;
  const closable = opposite ? position.abs() : big(0);
  const held = opposite ? big(0) : position.abs();
  const unitCost = orderCost(
    side,
    '1',
    limitPrice,
    lastPrice,
    markPrice,
    leverage,
  );
  const notionalPrice =
    limitPrice ?? big(lastPrice).times(big(1).plus(MARKET_PRICE_BUFFER));
  const funds = big(budget).gt(0) ? big(budget) : big(0);
  const byBudget = funds.div(unitCost);
  const rawByNotional = big(maxNotional).div(notionalPrice).minus(held);
  const byNotional = rawByNotional.gt(0) ? rawByNotional : big(0);
  return toStep(
    closable.plus(byBudget.lt(byNotional) ? byBudget : byNotional),
    stepSize,
  );
}

/** What can come out of an isolated position: max(0, min(IW, IW + uPnL − notional/L)). */
export function maxRemovableMargin(
  isolatedWallet: string,
  unrealized: string,
  markNotional: string,
  leverage: number,
): string {
  const needed = big(markNotional).abs().div(requireLeverage(leverage));
  const room = big(isolatedWallet).plus(unrealized).minus(needed);
  const capped = room.lt(isolatedWallet) ? room : big(isolatedWallet);
  return amount(capped.gt(0) ? capped : big(0));
}

/** Maintenance over margin balance; null when the balance is zero or below. */
export function marginRatio(
  maintenance: string,
  marginBalance: string,
): string | null {
  if (!big(marginBalance).gt(0)) return null;
  return big(maintenance).div(marginBalance).toString();
}

// ---------------------------------------------------------------- liquidation price

function toTick(value: BigValue, tickSize: string, up: boolean): string {
  const places = (tickSize.split('.')[1] ?? '').replace(/0+$/, '').length;
  return value
    .div(tickSize)
    .round(0, up ? Big.roundUp : Big.roundDown)
    .times(tickSize)
    .toFixed(places);
}

/**
 * The liquidation price of a one-way position (4.5):
 * LP = (WB − TMM + UPNL + cum − side × Q × E) / (Q × (MMR − side)), the
 * bracket the one of the notional at that price; rounded to the tick
 * towards the position (long up, short down); '0' when no price
 * liquidates it.
 */
export function liquidationPrice(
  direction: Direction,
  quantity: string,
  entryPrice: string,
  walletBalance: string,
  otherMaintenanceMargin: string,
  otherUnrealizedPnl: string,
  brackets: readonly Bracket[],
  tickSize: string,
): string {
  requirePositive(quantity, 'quantity');
  const side = signOf(direction);
  const base = big(walletBalance)
    .minus(otherMaintenanceMargin)
    .plus(otherUnrealizedPnl)
    .minus(big(quantity).times(entryPrice).times(side));
  const resolved = withMaintenanceAmounts(brackets);
  const last = resolved[resolved.length - 1];
  if (!last) throw new Error('the pair has no leverage bracket');
  const find = (notional: BigValue) =>
    resolved.find(
      (b) => notional.gte(b.notionalFloor) && notional.lt(b.notionalCap),
    ) ?? last;
  let bracket = find(big(quantity).times(entryPrice));
  let raw = big(0);
  for (let attempt = 0; attempt <= resolved.length; attempt++) {
    const denominator = big(quantity).times(
      big(bracket.maintenanceMarginRate).minus(side),
    );
    raw = base.plus(bracket.maintenanceAmount).div(denominator);
    if (!raw.gt(0)) return '0';
    const atPrice = find(big(quantity).times(raw));
    if (atPrice.bracketNo === bracket.bracketNo) break;
    bracket = atPrice;
  }
  return toTick(raw, tickSize, direction === 'LONG');
}

// ---------------------------------------------------------------- cash flows

export interface IsolatedCashFlow {
  branch: 'RELEASE' | 'LOSS_ABSORB' | 'INSURANCE';
  isolatedWalletChange: string;
  crossChange: string;
  insuranceCover: string;
}

const flow = (
  branch: IsolatedCashFlow['branch'],
  wallet: BigValue,
  cross: BigValue,
  cover: BigValue,
): IsolatedCashFlow => ({
  branch,
  isolatedWalletChange: amount(wallet),
  crossChange: amount(cross),
  insuranceCover: amount(cover),
});

/** Rule (A) of an isolated close (4.3). */
export function closeFlow(
  isolatedWallet: string,
  closedQuantity: string,
  positionQuantity: string,
  realizedPnl: string,
  fee: string,
): IsolatedCashFlow {
  requirePositive(closedQuantity, 'closedQuantity');
  const size = big(positionQuantity).abs();
  if (big(closedQuantity).gt(size))
    throw new Error('closed more than the position');
  const wallet = big(isolatedWallet);
  const released = big(closedQuantity).eq(size)
    ? wallet
    : big(amount(wallet.times(closedQuantity).div(size)));
  const result = big(realizedPnl).minus(fee);
  if (released.plus(result).gte(0))
    return flow('RELEASE', released.times(-1), released.plus(result), big(0));
  if (wallet.plus(result).gte(0))
    return flow('LOSS_ABSORB', result, big(0), big(0));
  return flow(
    'INSURANCE',
    wallet.times(-1),
    big(0),
    wallet.plus(result).times(-1),
  );
}

/** Rule (B) of funding on an isolated position (4.11). */
export function fundingFlow(
  isolatedWallet: string,
  fundingFee: string,
): IsolatedCashFlow {
  const wallet = big(isolatedWallet);
  if (wallet.plus(fundingFee).gte(0))
    return flow('RELEASE', big(fundingFee), big(0), big(0));
  return flow(
    'INSURANCE',
    wallet.times(-1),
    big(0),
    wallet.plus(fundingFee).times(-1),
  );
}

/** `−side × Q × mark × rate`, signed for the holder. */
export function fundingFee(
  direction: Direction,
  quantity: string,
  markPrice: string,
  fundingRate: string,
): string {
  return amount(
    big(quantity).times(markPrice).times(fundingRate).times(-signOf(direction)),
  );
}

/** `min(|notional| × rate, max(0, remaining))`. */
export function liquidationFee(
  notional: string,
  feeRate: string,
  remaining: string,
): string {
  const fee = big(notional).abs().times(feeRate);
  const left = big(remaining).gt(0) ? big(remaining) : big(0);
  return amount(fee.lt(left) ? fee : left);
}
