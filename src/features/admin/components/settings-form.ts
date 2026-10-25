import type { SystemSetting } from '../../../types/domain';
import { compare } from '../../../utils/decimal-math';
import { trimDecimal } from '../../../utils/decimal-format';

/** SCR-43 groups, in screen order; a key not listed goes to `other`. */
export type SettingGroup =
  'fees' | 'planWarnings' | 'uploads' | 'orders' | 'verification' | 'other';

const GROUPS: Readonly<Record<Exclude<SettingGroup, 'other'>, string[]>> = {
  fees: [
    'SPOT_MAKER_FEE',
    'SPOT_TAKER_FEE',
    'FUTURES_MAKER_FEE',
    'FUTURES_TAKER_FEE',
    'LIQUIDATION_CLEARANCE_FEE',
    'SLIPPAGE_BPS',
  ],
  planWarnings: [
    'WARN_LOW_RR_RATIO',
    'WARN_WIDE_STOP_LOSS_PERCENT',
    'WARN_HIGH_FUNDING_RATE',
    'FEE_RISK_WARN_RATIO',
    'ENTRY_DEVIATION_CONFIRM_R',
    'ENTRY_DEVIATION_BLOCK_R',
    'SETUP_SCORE_DROP_WARN',
  ],
  uploads: [
    'MAX_IMAGES_PER_POST',
    'MAX_IMAGE_SIZE_MB',
    'MAX_VIDEO_SIZE_MB',
    'MAX_VIDEO_DURATION_SECONDS',
  ],
  orders: ['ORDER_EXPIRY_MINUTES'],
  verification: ['RESEND_MIN_INTERVAL_SECONDS', 'RESEND_MAX_PER_24_HOURS'],
};
const ORDER = Object.values(GROUPS).flat();

/** The settings by group, each group in its order, empty groups left out. */
export function groupSettings(
  settings: readonly SystemSetting[],
): { group: SettingGroup; settings: SystemSetting[] }[] {
  const of = (key: string): SettingGroup =>
    (Object.keys(GROUPS) as (keyof typeof GROUPS)[]).find((group) =>
      GROUPS[group].includes(key),
    ) ?? 'other';
  const rank = (key: string) => {
    const index = ORDER.indexOf(key);
    return index === -1 ? ORDER.length : index;
  };
  const sorted = [...settings].sort(
    (a, b) => rank(a.key) - rank(b.key) || a.key.localeCompare(b.key),
  );
  return (
    [
      'fees',
      'planWarnings',
      'uploads',
      'orders',
      'verification',
      'other',
    ] as const
  )
    .map((group) => ({
      group,
      settings: sorted.filter((setting) => of(setting.key) === group),
    }))
    .filter((entry) => entry.settings.length > 0);
}

/** The value as the field shows it: a decimal without its padding zeros. */
export const shownValue = (setting: SystemSetting) =>
  setting.valueType === 'DECIMAL'
    ? trimDecimal(setting.value, 0)
    : setting.value;

/** A fee is a rate: its percent is shown beside it. */
export const isRate = (key: string) => key.endsWith('_FEE');

/**
 * BR-69: the deviation that needs a confirmation is at most the one that
 * is refused; the server keeps them in that order.
 */
export const AT_MOST: Readonly<Record<string, string>> = {
  ENTRY_DEVIATION_CONFIRM_R: 'ENTRY_DEVIATION_BLOCK_R',
};

export type SettingError =
  | { kind: 'required' }
  | { kind: 'whole' }
  | { kind: 'number' }
  | { kind: 'range'; min: string | null; max: string | null }
  | {
      kind: 'order';
      bound: 'atMost' | 'atLeast';
      other: string;
      value: string;
    }
  | { kind: 'server'; messageCode: string };

const WHOLE = /^-?\d{1,18}$/;
const NUMBER = /^-?\d{1,20}(\.\d{1,18})?$/;

/** Why a typed value is refused before sending, or null. */
export function checkValue(
  setting: SystemSetting,
  typed: string,
): SettingError | null {
  const value = typed.trim();
  if (value === '') return { kind: 'required' };
  if (setting.valueType === 'BOOLEAN' || setting.valueType === 'STRING')
    return value.length > 500 ? { kind: 'range', min: null, max: null } : null;
  if (setting.valueType === 'INT' && !WHOLE.test(value))
    return { kind: 'whole' };
  if (!NUMBER.test(value)) return { kind: 'number' };
  if (
    (setting.min !== null && compare(value, setting.min) < 0) ||
    (setting.max !== null && compare(value, setting.max) > 0)
  )
    return { kind: 'range', min: setting.min, max: setting.max };
  return null;
}

/** Whether the typed value differs from the saved one. */
export function isChanged(setting: SystemSetting, typed: string): boolean {
  const value = typed.trim();
  if (setting.valueType === 'INT' || setting.valueType === 'DECIMAL')
    return !NUMBER.test(value) || compare(value, setting.value) !== 0;
  return value !== setting.value;
}

/**
 * The refusals of the whole draft: each changed value on its own, then the
 * BR-69 order between the two deviations as they would be once saved.
 */
export function checkDraft(
  settings: readonly SystemSetting[],
  draft: Readonly<Record<string, string>>,
): Record<string, SettingError> {
  const errors: Record<string, SettingError> = {};
  const byKey = new Map(settings.map((setting) => [setting.key, setting]));
  const valueOf = (key: string) => {
    const setting = byKey.get(key);
    return setting ? (draft[key] ?? shownValue(setting)).trim() : null;
  };
  for (const setting of settings) {
    const typed = draft[setting.key];
    if (typed === undefined || !isChanged(setting, typed)) continue;
    const error = checkValue(setting, typed);
    if (error) errors[setting.key] = error;
  }
  for (const [lower, upper] of Object.entries(AT_MOST)) {
    const low = valueOf(lower);
    const high = valueOf(upper);
    if (
      low === null ||
      high === null ||
      errors[lower] ||
      errors[upper] ||
      !NUMBER.test(low) ||
      !NUMBER.test(high) ||
      compare(low, high) <= 0
    )
      continue;
    // The message goes on the value being changed: the lower one if it is.
    errors[draft[lower] !== undefined ? lower : upper] =
      draft[lower] !== undefined
        ? { kind: 'order', bound: 'atMost', other: upper, value: high }
        : { kind: 'order', bound: 'atLeast', other: lower, value: low };
  }
  return errors;
}

export interface SettingChange {
  setting: SystemSetting;
  value: string;
}

/** The changed values, in screen order. */
export function changesOf(
  settings: readonly SystemSetting[],
  draft: Readonly<Record<string, string>>,
): SettingChange[] {
  return groupSettings(settings)
    .flatMap((entry) => entry.settings)
    .flatMap((setting) => {
      const typed = draft[setting.key];
      return typed !== undefined && isChanged(setting, typed)
        ? [{ setting, value: typed.trim() }]
        : [];
    });
}
