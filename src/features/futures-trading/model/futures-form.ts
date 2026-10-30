import type { MarketPair } from '../../../types/domain';
import type {
  FuturesAccount,
  FuturesLeverageBracket,
  FuturesPosition,
  FuturesSymbolConfig,
  PositionSide,
} from '../../../types/futures';
import {
  compare,
  isPlainDecimal,
  isPositive,
  subtract,
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

export type FuturesFormType = 'LIMIT' | 'MARKET';

export interface FuturesDraft {
  type: FuturesFormType;
  price: string;
  size: string;
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
  size: '',
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
  /** Closes a hedge side, or reduces only. */
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

export type FuturesField = 'price' | 'size' | 'takeProfit' | 'stopLoss';

/** What the form refuses before sending; the server checks the rest. */
export function checkDraft(
  draft: FuturesDraft,
): Partial<Record<FuturesField, 'required' | 'invalid'>> {
  const errors: Partial<Record<FuturesField, 'required' | 'invalid'>> = {};
  const positive = (field: FuturesField, value: string, required: boolean) => {
    if (value.trim() === '') {
      if (required) errors[field] = 'required';
    } else if (!isPlainDecimal(value) || !isPositive(value))
      errors[field] = 'invalid';
  };
  if (draft.type === 'LIMIT') positive('price', draft.price, true);
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

/** The Cost and Max shown under a button (4.6, 4.8); null while not known. */
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
  const limit =
    draft.type === 'LIMIT' &&
    isPlainDecimal(draft.price) &&
    isPositive(draft.price)
      ? draft.price
      : null;
  if (!config || !last || !mark || (draft.type === 'LIMIT' && !limit))
    return { cost: null, max: null };
  const short = size.startsWith('-');
  const opposite =
    isPositive(size.replace('-', '')) &&
    ((action.side === 'BUY' && short) || (action.side === 'SELL' && !short));
  let max: string | null = null;
  if (budget && brackets && pair.stepSize)
    max = action.closing
      ? size.replace('-', '')
      : maxOpenQuantity(
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
  let cost: string | null = null;
  if (
    isPlainDecimal(draft.size) &&
    isPositive(draft.size) &&
    !action.closing &&
    !draft.reduceOnly
  ) {
    const closable = opposite ? size.replace('-', '') : '0';
    const opening =
      compare(draft.size, closable) > 0 ? subtract(draft.size, closable) : '0';
    cost = isPositive(opening)
      ? orderCost(action.side, opening, limit, last, mark, config.leverage)
      : '0';
  } else if (isPlainDecimal(draft.size)) cost = '0';
  return { cost, max };
}
