import BigBase from 'big.js';

/**
 * Exact decimal arithmetic for the trading forms (D-95, ADR-019): strings
 * in, strings out, never `number`. Its own constructor, so the library's
 * global settings stay untouched: 18 digits on division, round-down by
 * default, plain notation (no exponent) in every result.
 */
const Big = BigBase();
Big.DP = 18;
Big.RM = Big.roundDown;
Big.NE = -40;
Big.PE = 60;

export type Rounding = 'down' | 'up' | 'half-up';
const MODES = { down: 0, 'half-up': 1, up: 3 } as const;

const PLAIN = /^\d+(\.\d+)?$/;
const ZERO_TRAIL = /\.?0+$/;

/** A plain non-negative decimal as typed in a form ("12", "0.5"); no sign, no exponent. */
export function isPlainDecimal(value: string): boolean {
  return PLAIN.test(value.trim());
}

/** Digits after the point of a step ("0.00100" → 3, "1" → 0, "10" → 0). */
function placesOf(step: string): number {
  const fraction = step.split('.')[1] ?? '';
  return fraction.replace(/0+$/, '').length;
}

export const add = (a: string, b: string) => new Big(a).plus(b).toString();
export const subtract = (a: string, b: string) =>
  new Big(a).minus(b).toString();
export const multiply = (a: string, b: string) =>
  new Big(a).times(b).toString();

/** a ÷ b to `places` digits (18 by default), rounded as asked. */
export function divide(
  a: string,
  b: string,
  places = 18,
  rounding: Rounding = 'down',
): string {
  const quotient = new Big(a).div(b);
  return trim(quotient.round(places, MODES[rounding]).toFixed(places));
}

export function compare(a: string, b: string): -1 | 0 | 1 {
  return new Big(a).cmp(b) as -1 | 0 | 1;
}

export const isPositive = (value: string) => new Big(value).gt(0);

/** The smaller of two decimals. */
export const min = (a: string, b: string) => (compare(a, b) <= 0 ? a : b);

/**
 * A value on a step (a tick or a quantity step): a whole number of steps,
 * shown with the step's digits. Quantities and Buy prices go down, Sell
 * prices up, so the order never asks more than the Trader set.
 */
export function toStep(
  value: string,
  step: string,
  rounding: Rounding,
): string {
  const steps = new Big(value).div(step).round(0, MODES[rounding]);
  return steps.times(step).toFixed(placesOf(step));
}

/** `percent` % of a value, rounded down to `places` digits. */
export function percentOf(value: string, percent: number, places: number) {
  return new Big(value)
    .times(percent)
    .div(100)
    .round(places, 0)
    .toFixed(places);
}

/** Drops trailing fraction zeros ("1.500" → "1.5", "2.000" → "2"). */
function trim(value: string): string {
  return value.includes('.') ? value.replace(ZERO_TRAIL, '') || '0' : value;
}
