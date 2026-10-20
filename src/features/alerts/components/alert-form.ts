import type {
  Alert,
  AlertCondition,
  AlertIndicator,
  AlertRule,
  AlertTriggerMode,
  AlertType,
  CandleTimeframe,
  MarketType,
} from '../../../types/domain';

/**
 * SCR-14 form model (SRS 3.4.2, BR-19, BR-20) and the client mirror of
 * `AlertRuleValidator`: which fields a type and an
 * indicator take, their ranges and the 90-day expiry. The server checks
 * again; its field errors use the same keys.
 */
export interface AlertDraft {
  market: MarketType;
  type: AlertType;
  indicator: AlertIndicator;
  timeframe: CandleTimeframe;
  condition: AlertCondition;
  threshold: string;
  triggerMode: AlertTriggerMode;
  cooldown: string;
  notifyEmail: boolean;
  notifyPush: boolean;
  /** `datetime-local` value in the Trader's time zone; empty = none. */
  expiry: string;
}

export type AlertField =
  | 'market'
  | 'indicator'
  | 'timeframe'
  | 'condition'
  | 'threshold'
  | 'cooldownMinutes'
  | 'expiresAt';

export type ClientError =
  | { kind: 'required' }
  | { kind: 'number' }
  | { kind: 'positive' }
  | { kind: 'range'; min: string; max: string }
  | { kind: 'cooldown' }
  | { kind: 'expiry' };

export const INDICATORS: readonly AlertIndicator[] = [
  'RSI_14',
  'MACD_CROSS',
  'EMA_CROSS',
  'OPEN_INTEREST_CHANGE',
  'FUNDING_RATE',
];
export const CONDITIONS: readonly AlertCondition[] = [
  'CROSS_ABOVE',
  'CROSS_BELOW',
  'GREATER_THAN',
  'LESS_THAN',
];
export const CROSSES: readonly AlertCondition[] = [
  'CROSS_ABOVE',
  'CROSS_BELOW',
];
export const MODES: readonly AlertTriggerMode[] = [
  'ONCE',
  'ONCE_PER_BAR',
  'EVERY_TIME',
];
export const TIMEFRAMES: readonly CandleTimeframe[] = ['15m', '1h', '4h', '1d'];

/** Futures only; the server evaluates them on 1h and takes no timeframe (A-40). */
export const FUTURES_INDICATORS: ReadonlySet<AlertIndicator> = new Set([
  'FUNDING_RATE',
  'OPEN_INTEREST_CHANGE',
]);
/**
 * A FUNDING_RATE threshold is typed, sent and shown in percent (0.01 %),
 * as the server stores and checks it (Q-30): at most 5 % either side.
 */
export const FUNDING_MAX_PERCENT = '5';
const LINE_CROSSES: ReadonlySet<AlertIndicator> = new Set([
  'MACD_CROSS',
  'EMA_CROSS',
]);

export const MAX_EXPIRY_DAYS = 90;
const DAY_MS = 86_400_000;
const DECIMAL = /^-?\d{1,16}(\.\d{1,12})?$/;

/** What the type / indicator combination asks for. */
export function shapeOf(draft: Pick<AlertDraft, 'type' | 'indicator'>) {
  const indicator = draft.type === 'INDICATOR' ? draft.indicator : null;
  return {
    indicator,
    timeframe: indicator !== null && !FUTURES_INDICATORS.has(indicator),
    threshold: indicator === null || !LINE_CROSSES.has(indicator),
    crossesOnly: indicator !== null && LINE_CROSSES.has(indicator),
    futuresOnly: indicator !== null && FUTURES_INDICATORS.has(indicator),
  };
}

const pad = (n: number) => String(n).padStart(2, '0');
/** An instant as a `datetime-local` value in the local time zone. */
export function toLocalInput(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Strips the scale padding of a stored threshold for editing. */
function editable(value: string | null): string {
  if (value === null) return '';
  return value.includes('.') ? value.replace(/\.?0+$/, '') : value;
}

export function newDraft(market: MarketType): AlertDraft {
  return {
    market,
    type: 'PRICE',
    indicator: 'RSI_14',
    timeframe: '1h',
    condition: 'CROSS_ABOVE',
    threshold: '',
    triggerMode: 'ONCE',
    cooldown: '',
    notifyEmail: false,
    notifyPush: false,
    expiry: '',
  };
}

export function draftOf(alert: Alert): AlertDraft {
  return {
    market: alert.market,
    type: alert.type,
    indicator: alert.indicator ?? 'RSI_14',
    timeframe:
      alert.timeframe && !FUTURES_INDICATORS.has(alert.indicator ?? 'RSI_14')
        ? alert.timeframe
        : '1h',
    condition: alert.condition,
    threshold: editable(alert.threshold),
    triggerMode: alert.triggerMode,
    cooldown:
      alert.cooldownMinutes === null ? '' : String(alert.cooldownMinutes),
    notifyEmail: alert.notifyEmail,
    notifyPush: alert.notifyPush,
    expiry: alert.expiresAt ? toLocalInput(alert.expiresAt) : '',
  };
}

/**
 * Checks the draft and builds the rule the API takes, with null for every
 * field the combination does not take (the server refuses them).
 */
export function toRule(
  draft: AlertDraft,
  now: number = Date.now(),
):
  | { ok: true; rule: AlertRule }
  | { ok: false; errors: Partial<Record<AlertField, ClientError>> } {
  const shape = shapeOf(draft);
  const errors: Partial<Record<AlertField, ClientError>> = {};
  const threshold = draft.threshold.trim();
  if (shape.threshold) {
    if (threshold === '') errors.threshold = { kind: 'required' };
    else if (!DECIMAL.test(threshold)) errors.threshold = { kind: 'number' };
    else if (shape.indicator === null && Number(threshold) <= 0)
      errors.threshold = { kind: 'positive' };
    else if (
      shape.indicator === 'FUNDING_RATE' &&
      Math.abs(Number(threshold)) > Number(FUNDING_MAX_PERCENT)
    )
      errors.threshold = {
        kind: 'range',
        min: '-' + FUNDING_MAX_PERCENT,
        max: FUNDING_MAX_PERCENT,
      };
    else if (
      shape.indicator === 'RSI_14' &&
      (Number(threshold) < 0 || Number(threshold) > 100)
    )
      errors.threshold = { kind: 'range', min: '0', max: '100' };
  }
  if (shape.futuresOnly && draft.market !== 'futures')
    errors.market = { kind: 'required' };
  if (shape.crossesOnly && !CROSSES.includes(draft.condition))
    errors.condition = { kind: 'required' };
  let cooldown: number | null = null;
  if (draft.triggerMode === 'EVERY_TIME') {
    const raw = draft.cooldown.trim();
    if (raw === '') errors.cooldownMinutes = { kind: 'required' };
    else if (!/^\d+$/.test(raw) || Number(raw) < 1)
      errors.cooldownMinutes = { kind: 'cooldown' };
    else cooldown = Number(raw);
  }
  let expiresAt: string | null = null;
  if (draft.expiry !== '') {
    const at = new Date(draft.expiry).getTime();
    if (Number.isNaN(at) || at <= now || at > now + MAX_EXPIRY_DAYS * DAY_MS)
      errors.expiresAt = { kind: 'expiry' };
    else expiresAt = new Date(at).toISOString();
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    rule: {
      market: draft.market,
      type: draft.type,
      indicator: shape.indicator,
      timeframe: shape.timeframe ? draft.timeframe : null,
      condition: draft.condition,
      threshold: shape.threshold ? threshold : null,
      triggerMode: draft.triggerMode,
      cooldownMinutes: cooldown,
      notifyEmail: draft.notifyEmail,
      notifyPush: draft.notifyPush,
      expiresAt,
    },
  };
}
