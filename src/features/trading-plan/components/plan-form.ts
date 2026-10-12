import type {
  MarketType,
  PlanDirection,
  PlanEntryType,
  PlanInputs,
  TradingPlan,
} from '../../../types/domain';
import { trimDecimal } from '../../../utils/decimal-format';
import { toLocalInput } from '../../../utils/instant-format';

/**
 * SCR-17 form model (SRS 3.5.1) and the client mirror of the request rules
 * (CR-05): required fields, ranges (BR-30) and the price order (BR-22) are
 * checked before `/plans/calculate` is called; the server checks again and
 * its field errors use the same keys.
 */
export interface PlanDraft {
  market: MarketType;
  direction: PlanDirection;
  entryType: PlanEntryType;
  entryPrice: string;
  stopLoss: string;
  takeProfit: string;
  capital: string;
  riskPercent: string;
  leverage: string;
  /** `datetime-local` value in the Trader's time zone; empty = server default. */
  expiry: string;
  note: string;
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
  | 'note';

export type PlanFieldError =
  | { kind: 'required' }
  | { kind: 'number' }
  | { kind: 'positive' }
  | { kind: 'range'; min: string; max: string }
  | { kind: 'leverage' }
  | { kind: 'order' }
  | { kind: 'future' }
  | { kind: 'tooLong'; max: number };

export const NOTE_MAX = 1000;
const DECIMAL = /^\d{1,16}(\.\d{1,12})?$/;
const CAPITAL = /^\d{1,20}(\.\d{1,8})?$/;
const PERCENT = /^\d{1,2}(\.\d{1,3})?$/;

/** The stored DRAFT as form values, without the scale padding. */
export function draftOfPlan(plan: TradingPlan): PlanDraft {
  return {
    market: plan.market,
    direction: plan.direction,
    entryType: plan.entryType,
    entryPrice:
      plan.entryType === 'LIMIT' ? trimDecimal(plan.entryPrice, 0) : '',
    stopLoss: trimDecimal(plan.stopLoss, 0),
    takeProfit: trimDecimal(plan.takeProfit, 0),
    capital: trimDecimal(plan.capital, 0),
    riskPercent: trimDecimal(plan.riskPercent, 0),
    leverage: plan.leverage === null ? '' : String(plan.leverage),
    expiry: plan.expiresAt ? toLocalInput(plan.expiresAt) : '',
    note: plan.note ?? '',
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

/**
 * Checks the draft and builds the inputs the API takes. An empty capital or
 * risk % is left to the profile defaults; an empty expiry to the server's
 * 7 days (LIMIT); a MARKET entry is priced by the server.
 */
export function toInputs(
  draft: PlanDraft,
  now: number = Date.now(),
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
  const limit = draft.entryType === 'LIMIT';
  const entry = limit ? price('entryPrice') : '';
  const stop = price('stopLoss');
  const take = price('takeProfit');

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

  // BR-22: LONG stop < entry < take; SHORT take < entry < stop.
  if (limit && !errors.entryPrice) {
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
      entryPrice: limit ? entry : null,
      stopLoss: stop,
      takeProfit: take,
      capital: capital === '' ? null : capital,
      riskPercent: risk === '' ? null : risk,
      leverage,
      expiresAt,
      note: draft.note.trim() === '' ? null : draft.note.trim(),
    },
  };
}

/**
 * A server field error as the form shows it: MSG16 is the price order,
 * MSG15 a range (the server sends no bounds, M-11), anything else required.
 */
export function serverFieldError(
  field: PlanField,
  messageId: string,
): PlanFieldError {
  if (messageId === 'MSG16') return { kind: 'order' };
  if (messageId !== 'MSG15') return { kind: 'required' };
  if (field === 'riskPercent') return { kind: 'range', min: '0.1', max: '10' };
  if (field === 'leverage') return { kind: 'leverage' };
  if (field === 'note') return { kind: 'tooLong', max: NOTE_MAX };
  return { kind: 'positive' };
}
