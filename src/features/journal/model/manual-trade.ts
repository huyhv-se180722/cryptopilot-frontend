import type {
  JournalEntry,
  ManualTradeInput,
  MarketType,
  PlanDirection,
} from '../../../types/domain';
import { compareDecimal } from '../../../utils/decimal-format';
import { toLocalInput } from '../../../utils/instant-format';

/** The SCR-22 form as typed: decimals as plain strings, times local. */
export interface ManualDraft {
  market: MarketType;
  pairId: string;
  direction: PlanDirection;
  leverage: string;
  entryPrice: string;
  quantity: string;
  entryTime: string;
  stopLoss: string;
  takeProfit: string;
  exitPrice: string;
  exitTime: string;
  feeAmount: string;
  fundingFeeAmount: string;
  strategyId: string;
  setupDescription: string;
  lessonsLearned: string;
  mistakes: string;
}

export type ManualField = keyof ManualDraft;

/** Why a field is refused, before or by the server (UC-24). */
export type ManualError =
  | 'required'
  | 'positive'
  | 'signed'
  | 'leverage'
  | 'future'
  | 'exitOrder'
  | 'side'
  | 'spotShort'
  | 'unknown'
  | 'range';

const POSITIVE = /^\d+(\.\d+)?$/;
const SIGNED = /^-?\d+(\.\d+)?$/;

/** An empty form, or the manual trade being edited. */
export function draftOf(entry?: JournalEntry): ManualDraft {
  if (!entry)
    return {
      market: 'spot',
      pairId: '',
      direction: 'LONG',
      leverage: '',
      entryPrice: '',
      quantity: '',
      entryTime: '',
      stopLoss: '',
      takeProfit: '',
      exitPrice: '',
      exitTime: '',
      feeAmount: '',
      fundingFeeAmount: '',
      strategyId: '',
      setupDescription: '',
      lessonsLearned: '',
      mistakes: '',
    };
  const t = entry.trade;
  const plain = (value: string | null) =>
    value === null ? '' : value.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
  return {
    market: t.market,
    pairId: t.pairId,
    direction: t.direction,
    leverage: t.leverage === null ? '' : String(t.leverage),
    entryPrice: plain(t.entryPrice),
    quantity: plain(t.quantity),
    entryTime: toLocalInput(t.entryTime),
    stopLoss: plain(t.stopLoss),
    takeProfit: plain(t.takeProfit),
    exitPrice: plain(t.exitPrice),
    exitTime: t.exitTime === null ? '' : toLocalInput(t.exitTime),
    feeAmount: plain(t.feeAmount),
    fundingFeeAmount: plain(t.fundingFeeAmount),
    strategyId: entry.strategyId ?? '',
    setupDescription: entry.setupDescription ?? '',
    lessonsLearned: entry.lessonsLearned ?? '',
    mistakes: entry.mistakes ?? '',
  };
}

const text = (value: string) => (value.trim() === '' ? null : value);
const decimal = (value: string) => (value.trim() === '' ? null : value.trim());
/** A `datetime-local` value as an instant (the browser's zone). */
const instant = (value: string) =>
  value === '' ? null : new Date(value).toISOString();

/**
 * Checks the form as the backend will (UC-24, BR-22): required fields,
 * positive decimals, a past entry, an exit after it and both exit fields
 * or neither, stop loss and take profit on their side of the entry. The
 * P/L is the server's (BR-35) and is not computed here.
 */
export function checkDraft(
  draft: ManualDraft,
  now: number = Date.now(),
):
  | { ok: true; input: ManualTradeInput }
  | { ok: false; errors: Partial<Record<ManualField, ManualError>> } {
  const errors: Partial<Record<ManualField, ManualError>> = {};
  const futures = draft.market === 'futures';
  const need = (field: ManualField) => {
    if (draft[field].trim() === '') errors[field] = 'required';
  };
  need('pairId');
  need('entryPrice');
  need('quantity');
  need('entryTime');
  for (const field of [
    'entryPrice',
    'quantity',
    'stopLoss',
    'takeProfit',
    'exitPrice',
  ] as const) {
    const value = draft[field].trim();
    if (
      value !== '' &&
      (!POSITIVE.test(value) || compareDecimal(value, '0') <= 0)
    )
      errors[field] = 'positive';
  }
  if (draft.feeAmount.trim() !== '' && !POSITIVE.test(draft.feeAmount.trim()))
    errors.feeAmount = 'positive';
  if (
    draft.fundingFeeAmount.trim() !== '' &&
    !SIGNED.test(draft.fundingFeeAmount.trim())
  )
    errors.fundingFeeAmount = 'signed';
  if (futures && draft.leverage.trim() !== '') {
    const leverage = Number(draft.leverage);
    if (!Number.isInteger(leverage) || leverage < 1)
      errors.leverage = 'leverage';
  }
  if (!futures && draft.direction === 'SHORT') errors.direction = 'spotShort';
  const entryAt = draft.entryTime ? Date.parse(draft.entryTime) : NaN;
  if (!Number.isNaN(entryAt) && entryAt > now) errors.entryTime = 'future';
  const exitPrice = draft.exitPrice.trim();
  if (exitPrice !== '' && draft.exitTime === '') errors.exitTime = 'required';
  if (exitPrice === '' && draft.exitTime !== '')
    errors.exitPrice ??= 'required';
  if (draft.exitTime !== '') {
    const exitAt = Date.parse(draft.exitTime);
    if (exitAt > now || (!Number.isNaN(entryAt) && exitAt <= entryAt))
      errors.exitTime = 'exitOrder';
  }
  const entry = draft.entryPrice.trim();
  if (entry !== '' && !errors.entryPrice) {
    const long = draft.direction === 'LONG';
    const below = (field: 'stopLoss' | 'takeProfit') => {
      const value = draft[field].trim();
      return value !== '' && !errors[field]
        ? compareDecimal(value, entry) < 0
        : null;
    };
    const stopBelow = below('stopLoss');
    const targetBelow = below('takeProfit');
    if (stopBelow !== null && stopBelow !== long) errors.stopLoss = 'side';
    if (targetBelow !== null && targetBelow === long)
      errors.takeProfit = 'side';
  }
  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    input: {
      pairId: draft.pairId,
      market: draft.market,
      direction: draft.direction,
      leverage: futures && draft.leverage ? Number(draft.leverage) : null,
      entryPrice: draft.entryPrice.trim(),
      quantity: draft.quantity.trim(),
      entryTime: instant(draft.entryTime) ?? '',
      stopLoss: decimal(draft.stopLoss),
      takeProfit: decimal(draft.takeProfit),
      exitPrice: decimal(draft.exitPrice),
      exitTime: instant(draft.exitTime),
      feeAmount: decimal(draft.feeAmount),
      fundingFeeAmount: futures ? decimal(draft.fundingFeeAmount) : null,
      strategyId: draft.strategyId || null,
      setupDescription: text(draft.setupDescription),
      lessonsLearned: text(draft.lessonsLearned),
      mistakes: text(draft.mistakes),
    },
  };
}

/** A server field error (MSG01, MSG15, MSG16) as one of the form's reasons. */
export function serverError(field: string, id: string): ManualError {
  if (id === 'MSG01') return 'required';
  if (id === 'MSG16') return field === 'direction' ? 'spotShort' : 'side';
  if (field === 'pairId' || field === 'strategyId') return 'unknown';
  if (field === 'entryTime') return 'future';
  if (field === 'exitTime') return 'exitOrder';
  if (field === 'leverage') return 'leverage';
  return 'range';
}
