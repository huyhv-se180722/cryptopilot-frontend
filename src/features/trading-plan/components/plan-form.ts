import type {
  MarketType,
  PlanDirection,
  PlanEntryType,
  PlanInputs,
  PlanTimeframe,
  TradingPlan,
  TradingStyle,
} from '../../../types/domain';
import { trimDecimal } from '../../../utils/decimal-format';
import { toLocalInput } from '../../../utils/instant-format';

/**
 * SCR-17 form model (SRS 3.5.1) and the client mirror of the request rules
 * (CR-05): required fields, ranges (BR-30, BR-69) and the price order
 * (BR-22) are checked before `/plans/calculate` is called; the server
 * checks again and its field errors use the same keys. Where the
 * invalidation price lies against the last price (BR-68) and whether a
 * stop entry has been reached only the server can tell.
 */
export interface PlanDraft {
  market: MarketType;
  direction: PlanDirection;
  entryType: PlanEntryType;
  /** The limit price, or the stop price of a STOP entry. */
  entryPrice: string;
  stopLoss: string;
  takeProfit: string;
  capital: string;
  riskPercent: string;
  leverage: string;
  /** `datetime-local` value in the Trader's time zone; empty = server default. */
  expiry: string;
  note: string;
  /** LIMIT and STOP only; empty = none. */
  invalidationPrice: string;
  /** In R; empty = the system's limit. */
  maxEntryDeviationR: string;
  /** Empty = the trading style's, chosen by the server. */
  analysisTimeframe: PlanTimeframe | '';
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

export type PlanFieldError =
  | { kind: 'required' }
  | { kind: 'number' }
  | { kind: 'positive' }
  | { kind: 'range'; min: string; max: string }
  | { kind: 'leverage' }
  | { kind: 'order' }
  | { kind: 'future' }
  | { kind: 'tooLong'; max: number }
  /** BR-69: above 0 and at most the system's limit. */
  | { kind: 'deviation'; max: string }
  /** BR-68: the invalidation price is not beyond the last price (MSG16). */
  | { kind: 'invalidationSide' }
  /** D-111: the last price has already reached the stop entry (MSG16). */
  | { kind: 'stopReached' };

export const NOTE_MAX = 1000;
/** `ENTRY_DEVIATION_BLOCK_R` (BR-69); a plan's own limit may only be lower. */
export const ENTRY_DEVIATION_MAX_R = '0.75';
export const PLAN_TIMEFRAMES: readonly PlanTimeframe[] = [
  '15m',
  '1h',
  '4h',
  '1d',
];
const DECIMAL = /^\d{1,16}(\.\d{1,12})?$/;
const CAPITAL = /^\d{1,20}(\.\d{1,8})?$/;
const PERCENT = /^\d{1,2}(\.\d{1,3})?$/;
const R_MULTIPLE = /^\d{1,4}(\.\d{1,8})?$/;

/**
 * The analysis timeframe a new plan starts on, from the Trader's trading
 * style as the backend defaults it (D-112): SCALPING 15m, DAY 1h, SWING and
 * POSITION 4h, none 1h.
 */
export function timeframeOfStyle(style: TradingStyle | null): PlanTimeframe {
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

/** A new plan: Spot, LONG, a limit entry, the profile's capital and risk. */
export const EMPTY_PLAN_DRAFT: PlanDraft = {
  market: 'spot',
  direction: 'LONG',
  entryType: 'LIMIT',
  entryPrice: '',
  stopLoss: '',
  takeProfit: '',
  capital: '',
  riskPercent: '',
  leverage: '',
  expiry: '',
  note: '',
  invalidationPrice: '',
  maxEntryDeviationR: '',
  analysisTimeframe: '',
};

/** True for the entries priced by the Trader: LIMIT and STOP. */
export const pricedEntry = (entryType: PlanEntryType) => entryType !== 'MARKET';

/** The stored DRAFT as form values, without the scale padding. */
export function draftOfPlan(plan: TradingPlan): PlanDraft {
  const trimmed = (value: string | null) =>
    value === null ? '' : trimDecimal(value, 0);
  return {
    market: plan.market,
    direction: plan.direction,
    entryType: plan.entryType,
    entryPrice: pricedEntry(plan.entryType) ? trimmed(plan.entryPrice) : '',
    stopLoss: trimmed(plan.stopLoss),
    takeProfit: trimmed(plan.takeProfit),
    capital: trimmed(plan.capital),
    riskPercent: trimmed(plan.riskPercent),
    leverage: plan.leverage === null ? '' : String(plan.leverage),
    expiry: plan.expiresAt ? toLocalInput(plan.expiresAt) : '',
    note: plan.note ?? '',
    invalidationPrice: trimmed(plan.invalidationPrice),
    maxEntryDeviationR: trimmed(plan.maxEntryDeviationR),
    analysisTimeframe: plan.analysisTimeframe ?? '',
  };
}

/** Exact comparison of two plain decimals (no float). */
function compare(a: string, b: string): number {
  const [aw = '', af = ''] = a.split('.');
  const [bw = '', bf = ''] = b.split('.');
  const width = Math.max(af.length, bf.length);
  const left = aw.replace(/^0+(?=\d)/, '') + af.padEnd(width, '0');
  const right = bw.replace(/^0+(?=\d)/, '') + bf.padEnd(width, '0');
  const x = left.replace(/^0+(?=\d)/, '');
  const y = right.replace(/^0+(?=\d)/, '');
  if (x.length !== y.length) return x.length - y.length;
  return x < y ? -1 : x > y ? 1 : 0;
}
const isZero = (value: string) => /^0*(\.0*)?$/.test(value);

/** A price typed in a way the chart can draw: a plain positive decimal. */
export const drawablePrice = (raw: string): string | null => {
  const value = raw.trim();
  return DECIMAL.test(value) && !isZero(value) ? value : null;
};

/**
 * Checks the draft and builds the inputs the API takes. An empty capital or
 * risk % is left to the profile defaults; an empty expiry to the server's
 * 7 days (LIMIT, STOP); a MARKET entry is priced by the server and has no
 * invalidation price; an empty deviation limit is the system's.
 */
export function toInputs(
  draft: PlanDraft,
  now: number = Date.now(),
):
  | { ok: true; inputs: PlanInputs }
  | { ok: false; errors: Partial<Record<PlanField, PlanFieldError>> } {
  const errors: Partial<Record<PlanField, PlanFieldError>> = {};
  const value = (raw: string) => raw.trim();
  const price = (
    field: 'entryPrice' | 'stopLoss' | 'takeProfit' | 'invalidationPrice',
  ) => {
    const raw = value(draft[field]);
    if (raw === '') errors[field] = { kind: 'required' };
    else if (!DECIMAL.test(raw)) errors[field] = { kind: 'number' };
    else if (isZero(raw)) errors[field] = { kind: 'positive' };
    return raw;
  };
  const priced = pricedEntry(draft.entryType);
  const entry = priced ? price('entryPrice') : '';
  const stop = price('stopLoss');
  const take = price('takeProfit');
  const invalidation =
    priced && value(draft.invalidationPrice) !== ''
      ? price('invalidationPrice')
      : '';

  const capital = value(draft.capital);
  if (capital !== '') {
    if (!CAPITAL.test(capital)) errors.capital = { kind: 'number' };
    else if (isZero(capital)) errors.capital = { kind: 'positive' };
  }
  const risk = value(draft.riskPercent);
  if (risk !== '') {
    if (!PERCENT.test(risk)) errors.riskPercent = { kind: 'number' };
    else if (compare(risk, '0.1') < 0 || compare(risk, '10') > 0)
      errors.riskPercent = { kind: 'range', min: '0.1', max: '10' };
  }
  const deviation = value(draft.maxEntryDeviationR);
  if (deviation !== '') {
    if (!R_MULTIPLE.test(deviation))
      errors.maxEntryDeviationR = { kind: 'number' };
    else if (isZero(deviation) || compare(deviation, ENTRY_DEVIATION_MAX_R) > 0)
      errors.maxEntryDeviationR = {
        kind: 'deviation',
        max: ENTRY_DEVIATION_MAX_R,
      };
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

  // BR-22: LONG stop < entry < take; SHORT take < entry < stop. A STOP
  // entry is ordered by its stop price like a limit.
  if (priced && !errors.entryPrice) {
    const long = draft.direction === 'LONG';
    if (
      !errors.stopLoss &&
      (long ? compare(stop, entry) >= 0 : compare(stop, entry) <= 0)
    )
      errors.stopLoss = { kind: 'order' };
    if (
      !errors.takeProfit &&
      (long ? compare(take, entry) <= 0 : compare(take, entry) >= 0)
    )
      errors.takeProfit = { kind: 'order' };
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    inputs: {
      market: draft.market,
      direction: draft.direction,
      entryType: draft.entryType,
      entryPrice: priced ? entry : null,
      stopLoss: stop,
      takeProfit: take,
      capital: capital === '' ? null : capital,
      riskPercent: risk === '' ? null : risk,
      leverage,
      expiresAt,
      note: draft.note.trim() === '' ? null : draft.note.trim(),
      invalidationPrice: invalidation === '' ? null : invalidation,
      maxEntryDeviationR: deviation === '' ? null : deviation,
      analysisTimeframe:
        draft.analysisTimeframe === '' ? null : draft.analysisTimeframe,
    },
  };
}

/**
 * A server field error as the form shows it: MSG16 is the price order, on
 * the invalidation price its side of the last price, on the entry a stop
 * already reached; MSG15 a range (the server sends no bounds, M-11);
 * anything else required.
 */
export function serverFieldError(
  field: PlanField,
  messageId: string,
): PlanFieldError {
  if (messageId === 'MSG16') {
    if (field === 'invalidationPrice') return { kind: 'invalidationSide' };
    if (field === 'entryPrice') return { kind: 'stopReached' };
    return { kind: 'order' };
  }
  if (messageId !== 'MSG15') return { kind: 'required' };
  if (field === 'riskPercent') return { kind: 'range', min: '0.1', max: '10' };
  if (field === 'leverage') return { kind: 'leverage' };
  if (field === 'note') return { kind: 'tooLong', max: NOTE_MAX };
  if (field === 'maxEntryDeviationR')
    return { kind: 'deviation', max: ENTRY_DEVIATION_MAX_R };
  return { kind: 'positive' };
}
