import type {
  CandleTimeframe,
  MarketType,
  PlanDirection,
  PlanEntryType,
  PlanInputs,
  TradingPlan,
  TradingStyle,
} from '../../../types/domain';
import { compare } from '../../../utils/decimal-math';
import { trimDecimal } from '../../../utils/decimal-format';
import { toLocalInput } from '../../../utils/instant-format';

/**
 * SCR-17 form model (SRS 3.5.1) and the client mirror of the request rules
 * (CR-05): required fields, ranges (BR-30), the price order (BR-22) and
 * the side of the invalidation price (TP-A) are checked before
 * `/plans/calculate` is called; the server checks again and its field
 * errors use the same keys.
 */
export interface PlanDraft {
  market: MarketType;
  direction: PlanDirection;
  entryType: PlanEntryType;
  /** LIMIT: the limit price; STOP: the stop price; unused for MARKET. */
  entryPrice: string;
  stopLoss: string;
  takeProfit: string;
  riskPercent: string;
  leverage: string;
  /** `datetime-local` value in the Trader's time zone; empty = server default. */
  expiry: string;
  note: string;
  /** Optional; LIMIT and STOP only. */
  invalidationPrice: string;
  /** Optional, in R. */
  maxEntryDeviation: string;
  /** Empty: the default of the Trader's style. */
  timeframe: CandleTimeframe | '';
}

export type PlanField =
  | 'direction'
  | 'entryPrice'
  | 'stopLoss'
  | 'takeProfit'
  | 'capital'
  | 'riskPercent'
  | 'leverage'
  | 'expiresAt'
  | 'note'
  | 'invalidationPrice'
  | 'maxEntryDeviationR'
  | 'analysisTimeframe';

/**
 * The `{rule}` of MSG16 the client fills itself (M-11): the price order,
 * the side of the invalidation price, or a level the current price has
 * already reached at activation (TP-B).
 */
export type PlanRule =
  | `order${PlanDirection}`
  | `invalidation${PlanDirection}${'LIMIT' | 'STOP'}`
  | `reached${'StopLoss' | 'TakeProfit' | 'Stop'}${PlanDirection}`;

export type PlanFieldError =
  | { kind: 'required' }
  | { kind: 'number' }
  | { kind: 'positive' }
  | { kind: 'range'; min: string; max: string }
  | { kind: 'leverage' }
  | { kind: 'leverageBracket' }
  | { kind: 'rule'; rule: PlanRule }
  | { kind: 'future' }
  | { kind: 'tooLong'; max: number };

export const NOTE_MAX = 1000;
/**
 * `ENTRY_DEVIATION_BLOCK_R`, the system limit a plan's own deviation limit
 * may only tighten (FE guide, TP-A; seed value). The server reads the
 * setting on each call and stays the authority (MSG15).
 */
export const ENTRY_DEVIATION_BLOCK_R = '0.75';
export const TIMEFRAMES: readonly CandleTimeframe[] = ['15m', '1h', '4h', '1d'];
const DECIMAL = /^\d{1,16}(\.\d{1,12})?$/;
const PERCENT = /^\d{1,2}(\.\d{1,3})?$/;
const R_VALUE = /^\d{1,4}(\.\d{1,8})?$/;

/** The default analysis timeframe of a trading style (TP-A). */
export function timeframeOfStyle(style: TradingStyle | null): CandleTimeframe {
  switch (style) {
    case 'SCALPING':
      return '15m';
    case 'SWING':
    case 'POSITION':
      return '4h';
    default:
      return '1h';
  }
}

/** A new plan: Spot, LONG, a limit entry, the profile's risk. */
export const EMPTY_PLAN_DRAFT: PlanDraft = {
  market: 'spot',
  direction: 'LONG',
  entryType: 'LIMIT',
  entryPrice: '',
  stopLoss: '',
  takeProfit: '',
  riskPercent: '',
  leverage: '',
  expiry: '',
  note: '',
  invalidationPrice: '',
  maxEntryDeviation: '',
  timeframe: '',
};

/** The stored DRAFT as form values, without the scale padding. */
export function draftOfPlan(plan: TradingPlan): PlanDraft {
  return {
    market: plan.market,
    direction: plan.direction,
    entryType: plan.entryType,
    entryPrice:
      plan.entryType === 'MARKET' ? '' : trimDecimal(plan.entryPrice, 0),
    stopLoss: trimDecimal(plan.stopLoss, 0),
    takeProfit: trimDecimal(plan.takeProfit, 0),
    riskPercent: trimDecimal(plan.riskPercent, 0),
    leverage: plan.leverage === null ? '' : String(plan.leverage),
    expiry: plan.expiresAt ? toLocalInput(plan.expiresAt) : '',
    note: plan.note ?? '',
    invalidationPrice: plan.invalidationPrice
      ? trimDecimal(plan.invalidationPrice, 0)
      : '',
    maxEntryDeviation: plan.maxEntryDeviationR
      ? trimDecimal(plan.maxEntryDeviationR, 0)
      : '',
    timeframe: plan.analysisTimeframe,
  };
}

const isZero = (value: string) => /^0*(\.0*)?$/.test(value);

/** A price typed in a way the chart can draw: a plain positive decimal. */
export const drawablePrice = (raw: string): string | null => {
  const value = raw.trim();
  return DECIMAL.test(value) && !isZero(value) ? value : null;
};

/**
 * Which side of the entry the invalidation price must lie on: the far side
 * of the current price from the entry, so the price can reach it first.
 * LONG LIMIT (entry below the price) and SHORT STOP: above; LONG STOP and
 * SHORT LIMIT: below. The client can only compare it with the entry; the
 * server compares it with the current last price.
 */
const invalidationAbove = (
  direction: PlanDirection,
  entryType: 'LIMIT' | 'STOP',
) => (direction === 'LONG') === (entryType === 'LIMIT');

/**
 * Checks the draft and builds the inputs the API takes. An empty risk % is
 * left to the profile default (the capital is always the profile's, TP-D);
 * an empty expiry to the server's 7 days (LIMIT, STOP); a MARKET entry is
 * priced by the server and has no invalidation price. `timeframe` is the
 * style's default used when the draft has none.
 */
export function toInputs(
  draft: PlanDraft,
  now: number = Date.now(),
  timeframe: CandleTimeframe | null = null,
):
  | { ok: true; inputs: PlanInputs }
  | { ok: false; errors: Partial<Record<PlanField, PlanFieldError>> } {
  const errors: Partial<Record<PlanField, PlanFieldError>> = {};
  const value = (raw: string) => raw.trim();
  const price = (field: 'entryPrice' | 'stopLoss' | 'takeProfit') => {
    const raw = value(draft[field]);
    if (raw === '') errors[field] = { kind: 'required' };
    else if (!DECIMAL.test(raw)) errors[field] = { kind: 'number' };
    else if (isZero(raw)) errors[field] = { kind: 'positive' };
    return raw;
  };
  // LIMIT: the limit price; STOP: the stop price; MARKET: priced by the server.
  const entryType = draft.entryType;
  const priced = entryType !== 'MARKET';
  const entry = priced ? price('entryPrice') : '';
  const stop = price('stopLoss');
  const take = price('takeProfit');

  const risk = value(draft.riskPercent);
  if (risk !== '') {
    if (!PERCENT.test(risk)) errors.riskPercent = { kind: 'number' };
    else if (compare(risk, '0.1') < 0 || compare(risk, '10') > 0)
      errors.riskPercent = { kind: 'range', min: '0.1', max: '10' };
  }
  let leverage: number | null = null;
  if (draft.market === 'futures') {
    const raw = value(draft.leverage);
    if (raw === '') errors.leverage = { kind: 'required' };
    else if (!/^\d+$/.test(raw) || Number(raw) < 1)
      errors.leverage = { kind: 'leverage' };
    else leverage = Number(raw);
  }
  if (draft.market === 'spot' && draft.direction === 'SHORT')
    errors.direction = { kind: 'required' };
  if (draft.note.length > NOTE_MAX)
    errors.note = { kind: 'tooLong', max: NOTE_MAX };
  let expiresAt: string | null = null;
  if (draft.expiry !== '') {
    const at = new Date(draft.expiry).getTime();
    if (Number.isNaN(at) || at <= now) errors.expiresAt = { kind: 'future' };
    else expiresAt = new Date(at).toISOString();
  }

  const deviation = value(draft.maxEntryDeviation);
  if (deviation !== '') {
    if (!R_VALUE.test(deviation))
      errors.maxEntryDeviationR = { kind: 'number' };
    else if (isZero(deviation))
      errors.maxEntryDeviationR = { kind: 'positive' };
    else if (compare(deviation, ENTRY_DEVIATION_BLOCK_R) > 0)
      errors.maxEntryDeviationR = {
        kind: 'range',
        min: '0',
        max: ENTRY_DEVIATION_BLOCK_R,
      };
  }

  const invalidation = priced ? value(draft.invalidationPrice) : '';
  if (invalidation !== '') {
    if (!DECIMAL.test(invalidation))
      errors.invalidationPrice = { kind: 'number' };
    else if (isZero(invalidation))
      errors.invalidationPrice = { kind: 'positive' };
  }

  // BR-22: LONG stop < entry < take; SHORT take < entry < stop.
  const long = draft.direction === 'LONG';
  if (priced && !errors.entryPrice) {
    if (
      !errors.stopLoss &&
      (long ? compare(stop, entry) >= 0 : compare(stop, entry) <= 0)
    )
      errors.stopLoss = { kind: 'rule', rule: `order${draft.direction}` };
    if (
      !errors.takeProfit &&
      (long ? compare(take, entry) <= 0 : compare(take, entry) >= 0)
    )
      errors.takeProfit = { kind: 'rule', rule: `order${draft.direction}` };
    // TP-A: the invalidation price on the far side of the entry.
    if (invalidation !== '' && !errors.invalidationPrice) {
      const type = entryType === 'STOP' ? 'STOP' : 'LIMIT';
      const above = invalidationAbove(draft.direction, type);
      const side = compare(invalidation, entry);
      if (above ? side <= 0 : side >= 0)
        errors.invalidationPrice = {
          kind: 'rule',
          rule: `invalidation${draft.direction}${type}`,
        };
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    inputs: {
      market: draft.market,
      direction: draft.direction,
      entryType,
      entryPrice: priced ? entry : null,
      stopLoss: stop,
      takeProfit: take,
      riskPercent: risk === '' ? null : risk,
      leverage,
      expiresAt,
      note: draft.note.trim() === '' ? null : draft.note.trim(),
      invalidationPrice: invalidation === '' ? null : invalidation,
      maxEntryDeviationR: deviation === '' ? null : deviation,
      analysisTimeframe: draft.timeframe || timeframe,
    },
  };
}

/**
 * A server field error as the form shows it (M-11: the server sends no
 * arguments). MSG16 is the price order on a calculation, the invalidation
 * side, or, on an activation, a level the current price already reached
 * (TP-B: the stop loss, a LIMIT's take profit, a STOP's stop price); MSG15
 * a range; anything else required.
 */
export function serverFieldError(
  field: PlanField,
  messageId: string,
  draft: Pick<PlanDraft, 'direction' | 'entryType'>,
  activating = false,
): PlanFieldError {
  const direction = draft.direction;
  if (messageId === 'MSG16') {
    if (field === 'invalidationPrice')
      return {
        kind: 'rule',
        rule: `invalidation${direction}${draft.entryType === 'STOP' ? 'STOP' : 'LIMIT'}`,
      };
    if (activating && field === 'stopLoss')
      return { kind: 'rule', rule: `reachedStopLoss${direction}` };
    if (activating && field === 'takeProfit')
      return { kind: 'rule', rule: `reachedTakeProfit${direction}` };
    if (activating && field === 'entryPrice')
      return { kind: 'rule', rule: `reachedStop${direction}` };
    return { kind: 'rule', rule: `order${direction}` };
  }
  if (messageId !== 'MSG15') return { kind: 'required' };
  if (field === 'riskPercent') return { kind: 'range', min: '0.1', max: '10' };
  if (field === 'maxEntryDeviationR')
    return { kind: 'range', min: '0', max: ENTRY_DEVIATION_BLOCK_R };
  // No leverage brackets for the pair, or above the bracket maximum.
  if (field === 'leverage') return { kind: 'leverageBracket' };
  if (field === 'note') return { kind: 'tooLong', max: NOTE_MAX };
  return { kind: 'positive' };
}
