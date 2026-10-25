import type { AdminSettingService } from '../services/api/contracts';
import { ServiceError } from '../services/api/errors';
import type { SettingValueType, SystemSetting } from '../types/domain';
import { compare } from '../utils/decimal-math';

/**
 * DEVELOPMENT ONLY. In-memory `/admin/settings/**` for SCR-43 with the
 * backend's refusals on `errors.value`: not of the type (MSG01 → MSG15),
 * out of range or with too many decimal places (MSG15), the confirmation
 * deviation above the refused one (BR-69, MSG15) and an unknown key
 * (MSG41). A reload restores the seeded values.
 */
function refuse(
  status: number,
  code: string,
  messageCode: string,
  fieldErrors: Readonly<Record<string, string>> = {},
): never {
  throw new ServiceError('Development setting refusal.', 'HTTP_ERROR', status, {
    status,
    code,
    messageCode,
    messageArgs: [],
    fieldErrors,
  });
}

type Seed = [
  key: string,
  type: SettingValueType,
  value: string,
  range: [min: string, max: string, scale: number] | null,
];

const SEEDS: readonly Seed[] = [
  ['ENTRY_DEVIATION_BLOCK_R', 'DECIMAL', '0.75000000', ['0', '10', 8]],
  ['ENTRY_DEVIATION_CONFIRM_R', 'DECIMAL', '0.25000000', ['0', '10', 8]],
  ['FEE_RISK_WARN_RATIO', 'DECIMAL', '0.20000000', ['0.00000001', '1', 8]],
  ['FUTURES_MAKER_FEE', 'DECIMAL', '0.00020000', ['0', '0.1', 8]],
  ['FUTURES_TAKER_FEE', 'DECIMAL', '0.00050000', ['0', '0.1', 8]],
  ['LIQUIDATION_CLEARANCE_FEE', 'DECIMAL', '0.01250000', ['0', '0.1', 8]],
  ['MAX_IMAGES_PER_POST', 'INT', '4', ['1', '10', 0]],
  ['MAX_IMAGE_SIZE_MB', 'INT', '5', ['1', '20', 0]],
  ['MAX_VIDEO_DURATION_SECONDS', 'INT', '300', ['1', '600', 0]],
  ['MAX_VIDEO_SIZE_MB', 'INT', '100', ['1', '100', 0]],
  ['ORDER_EXPIRY_MINUTES', 'INT', '15', ['1', '1440', 0]],
  ['RESEND_MAX_PER_24_HOURS', 'INT', '5', ['1', '100', 0]],
  ['RESEND_MIN_INTERVAL_SECONDS', 'INT', '60', ['1', '3600', 0]],
  ['SETUP_SCORE_DROP_WARN', 'INT', '15', ['1', '100', 0]],
  ['SLIPPAGE_BPS', 'INT', '0', ['0', '100', 0]],
  ['SPOT_MAKER_FEE', 'DECIMAL', '0.00100000', ['0', '0.1', 8]],
  ['SPOT_TAKER_FEE', 'DECIMAL', '0.00100000', ['0', '0.1', 8]],
  ['WARN_HIGH_FUNDING_RATE', 'DECIMAL', '0.00100000', ['0.00000001', '1', 8]],
  ['WARN_LOW_RR_RATIO', 'DECIMAL', '1.50000000', ['0.00000001', '100', 8]],
  ['WARN_WIDE_STOP_LOSS_PERCENT', 'DECIMAL', '10.000', ['0.001', '100', 3]],
];

const AT_MOST: Readonly<Record<string, string>> = {
  ENTRY_DEVIATION_CONFIRM_R: 'ENTRY_DEVIATION_BLOCK_R',
};

const NUMBER = /^-?\d+(\.\d+)?$/;
const places = (value: string) => value.split('.')[1]?.length ?? 0;

export function createDevelopmentAdminSettings(
  now: () => number = Date.now,
): AdminSettingService {
  const scales = new Map<string, number>();
  const settings = new Map<string, SystemSetting>();
  for (const [key, valueType, value, range] of SEEDS) {
    if (range) scales.set(key, range[2]);
    settings.set(key, {
      key,
      value,
      valueType,
      description: `Development value of ${key}.`,
      min: range?.[0] ?? null,
      max: range?.[1] ?? null,
      updatedBy: null,
      updatedAt: '2026-01-01T00:00:00Z',
    });
  }
  const pause = () => new Promise((resolve) => setTimeout(resolve, 120));
  const refused = () =>
    refuse(400, 'VALIDATION_FAILED', 'MSG01', { value: 'MSG15' });

  function plain(setting: SystemSetting, typed: string): string {
    const value = typed.trim();
    if (setting.valueType === 'BOOLEAN') {
      if (value !== 'true' && value !== 'false') refused();
      return value;
    }
    if (setting.valueType === 'STRING') return value;
    if (!NUMBER.test(value)) refused();
    if (setting.valueType === 'INT' && value.includes('.')) refused();
    const scale = scales.get(setting.key);
    if (scale !== undefined && places(value) > scale) refused();
    if (setting.min !== null && compare(value, setting.min) < 0) refused();
    if (setting.max !== null && compare(value, setting.max) > 0) refused();
    return value;
  }

  function ordered(key: string, value: string) {
    const above = AT_MOST[key];
    const partner = above && settings.get(above);
    if (partner && compare(value, partner.value) > 0) refused();
    const below = Object.keys(AT_MOST).find((each) => AT_MOST[each] === key);
    const lower = below && settings.get(below);
    if (lower && compare(value, lower.value) < 0) refused();
  }

  return {
    async list() {
      await pause();
      return [...settings.values()].sort((a, b) => a.key.localeCompare(b.key));
    },
    async update(key, typed) {
      await pause();
      const setting = settings.get(key);
      if (!setting) return refuse(404, 'RESOURCE_NOT_FOUND', 'MSG41');
      if (typed.trim() === '')
        refuse(400, 'VALIDATION_FAILED', 'MSG01', { value: 'MSG01' });
      const value = plain(setting, typed);
      if (setting.valueType !== 'BOOLEAN' && setting.valueType !== 'STRING')
        ordered(key, value);
      const next: SystemSetting = {
        ...setting,
        value,
        updatedBy: '0199a0f0-0000-7000-8000-00000000ad01',
        updatedAt: new Date(now()).toISOString(),
      };
      settings.set(key, next);
      return next;
    },
  };
}
