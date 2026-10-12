import {
  groupThousands,
  toFixedDecimal,
  trimDecimal,
} from '../../../utils/decimal-format';

/**
 * Plan prices arrive rounded to the pair's tick by the server but padded to
 * the column scale ("80000.000000000000"), so the padding is dropped (at
 * least 2 decimals; the tick itself needs the pair, FEQ-01); quantities keep
 * their significant digits; amounts in USDT with 2 decimals.
 */
export const planPrice = (value: string) =>
  groupThousands(trimDecimal(value, 2));
export const planQuantity = (value: string) => trimDecimal(value, 0);
export const planAmount = (value: string) =>
  groupThousands(toFixedDecimal(value, 2));
export const planRatio = (value: string) => toFixedDecimal(value, 2);
/** SCR-16 creation periods, in days. */
export const PLAN_PERIODS = ['7', '30', '90', 'all'] as const;
export type PlanPeriod = (typeof PLAN_PERIODS)[number];

/** The last 8 characters of the id, enough to tell plans apart on screen. */
export const shortPlanId = (id: string) =>
  id.split('-').at(-1)?.slice(-8) ?? id;
