import type {
  LeverageBracket,
  LeverageBracketInput,
} from '../../../types/domain';
import { compare, divide, multiply } from '../../../utils/decimal-math';
import { trimDecimal } from '../../../utils/decimal-format';

/**
 * SCR-38 rows as typed: the cap in USDT, the maximum leverage and the
 * maintenance margin rate in percent. Each floor is the cap of the row
 * before it (0 for the first), so the brackets always join up (BR-26).
 */
export interface BracketRow {
  cap: string;
  leverage: string;
  /** Percent: "0.4" is a rate of 0.004. */
  ratePercent: string;
}

export type BracketField =
  'notionalFloor' | 'notionalCap' | 'maxLeverage' | 'maintenanceMarginRate';
export type BracketError = 'required' | 'cap' | 'leverage' | 'rate' | 'server';
/** Keyed as the server keys its field errors: `brackets[1].notionalCap`. */
export type BracketErrors = Record<string, BracketError>;

export const BRACKETS_MAX = 50;
const AMOUNT = /^\d{1,20}(\.\d{1,8})?$/;
const PERCENT = /^\d{1,2}(\.\d{1,6})?$/;
const WHOLE = /^\d+$/;

export const errorKey = (index: number, field: BracketField) =>
  `brackets[${index}].${field}`;

export function rowsOf(brackets: readonly LeverageBracket[]): BracketRow[] {
  return brackets.map((bracket) => ({
    cap: trimDecimal(bracket.notionalCap, 0),
    leverage: String(bracket.maxLeverage),
    ratePercent: trimDecimal(multiply(bracket.maintenanceMarginRate, '100'), 0),
  }));
}

/** The floor of each row: the cap before it once that one is a number. */
export function floorsOf(rows: readonly BracketRow[]): (string | null)[] {
  return rows.map((_, index) => {
    if (index === 0) return '0';
    const cap = rows[index - 1]?.cap.trim() ?? '';
    return AMOUNT.test(cap) ? cap : null;
  });
}

/**
 * The rows as the request takes them, or the cells refused before sending:
 * a cap above its floor, a whole leverage from 1 to 125 that never rises
 * from one bracket to the next, a rate above 0 and below 100 % (BR-26).
 */
export function bracketInputs(
  rows: readonly BracketRow[],
):
  | { ok: true; inputs: LeverageBracketInput[] }
  | { ok: false; errors: BracketErrors } {
  const errors: BracketErrors = {};
  const floors = floorsOf(rows);
  const inputs: LeverageBracketInput[] = [];
  rows.forEach((row, index) => {
    const floor = floors[index] ?? null;
    const cap = row.cap.trim();
    const leverage = row.leverage.trim();
    const rate = row.ratePercent.trim();
    if (cap === '') errors[errorKey(index, 'notionalCap')] = 'required';
    else if (!AMOUNT.test(cap) || (floor !== null && compare(cap, floor) <= 0))
      errors[errorKey(index, 'notionalCap')] = 'cap';
    const previous = inputs[index - 1];
    if (leverage === '') errors[errorKey(index, 'maxLeverage')] = 'required';
    else if (
      !WHOLE.test(leverage) ||
      +leverage < 1 ||
      +leverage > 125 ||
      (previous !== undefined && +leverage > previous.maxLeverage)
    )
      errors[errorKey(index, 'maxLeverage')] = 'leverage';
    if (rate === '')
      errors[errorKey(index, 'maintenanceMarginRate')] = 'required';
    else if (!PERCENT.test(rate) || compare(rate, '0') <= 0)
      errors[errorKey(index, 'maintenanceMarginRate')] = 'rate';
    inputs.push({
      notionalFloor: floor ?? '0',
      notionalCap: cap,
      maxLeverage: WHOLE.test(leverage) ? +leverage : 0,
      maintenanceMarginRate: PERCENT.test(rate) ? divide(rate, '100', 8) : '0',
    });
  });
  return Object.keys(errors).length
    ? { ok: false, errors }
    : { ok: true, inputs };
}
