import type { Decimal, OrderBookLevel } from '../../../types/domain';
import {
  addDecimal,
  compareDecimal,
  decimalPlaces,
  groupThousands,
  toFixedDecimal,
} from '../../../utils/decimal-format';

/** One shown row: a price (or price group), its quantity and the running total. */
export interface BookRow {
  price: Decimal;
  quantity: Decimal;
  cumulative: Decimal;
}

const POWER_OF_TEN = /^(?:0\.0*1|10*)$/;

/** "0.01000000" → "0.01", "10.0" → "10". */
const normalize = (value: string) =>
  value.includes('.') ? value.replace(/0+$/, '').replace(/\.$/, '') : value;

/** "0.01" → -2, "1" → 0, "100" → 2 (power-of-ten steps only). */
const exponent = (step: string) =>
  step.startsWith('0.') ? -(step.length - 2) : step.length - 1;

const stepOf = (power: number) =>
  power < 0 ? '0.' + '0'.repeat(-power - 1) + '1' : '1' + '0'.repeat(power);

/**
 * The price groups an exchange offers in its order book: the tick, then
 * 10×, 100× and 1000× it. A tick that is not a power of ten is offered
 * alone (no grouping).
 */
export function groupSteps(tickSize: Decimal | null): Decimal[] {
  if (!tickSize) return [];
  const tick = normalize(tickSize);
  if (!POWER_OF_TEN.test(tick)) return [tick];
  const power = exponent(tick);
  return [0, 1, 2, 3].map((n) => stepOf(power + n));
}

/**
 * A positive price on a power-of-ten step: down for bids, up for asks, so
 * a group never shows a better price than its levels hold.
 */
export function toStep(price: Decimal, step: Decimal, up: boolean): Decimal {
  const normalized = normalize(step);
  if (!POWER_OF_TEN.test(normalized)) return price;
  const power = exponent(normalized);
  const [whole = '0', fraction = ''] = price.split('.');
  const floored =
    power <= 0
      ? -power > 0
        ? whole + '.' + fraction.padEnd(-power, '0').slice(0, -power)
        : whole
      : whole.length > power
        ? whole.slice(0, -power) + '0'.repeat(power)
        : '0';
  return up && compareDecimal(floored, price) < 0
    ? addDecimal(floored, normalized)
    : floored;
}

/**
 * Levels (best first) merged per price step, the first `count` groups with
 * the running quantity total, exactly as decimal strings.
 */
export function groupLevels(
  levels: readonly OrderBookLevel[],
  step: Decimal | null,
  side: 'bid' | 'ask',
  count: number,
): BookRow[] {
  const merged: { price: Decimal; quantity: Decimal }[] = [];
  for (const level of levels) {
    const price = step
      ? toStep(level.price, step, side === 'ask')
      : level.price;
    const last = merged[merged.length - 1];
    if (last && compareDecimal(last.price, price) === 0)
      last.quantity = addDecimal(last.quantity, level.quantity);
    else merged.push({ price, quantity: level.quantity });
  }
  let total = '0';
  return merged.slice(0, count).map((row) => {
    total = addDecimal(total, row.quantity);
    return { ...row, cumulative: total };
  });
}

/** A quantity at the pair's step, grouped for reading. */
export function formatQuantity(value: Decimal, stepSize: Decimal | null) {
  return groupThousands(
    stepSize ? toFixedDecimal(value, decimalPlaces(stepSize)) : value,
  );
}
