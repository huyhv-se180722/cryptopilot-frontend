import { describe, expect, it } from 'vitest';
import { toFixedDecimal } from './decimal-format';

describe('toFixedDecimal', () => {
  it('pads and rounds half-up to the requested places', () => {
    expect(toFixedDecimal('0.5', 2)).toBe('0.50');
    expect(toFixedDecimal('2', 2)).toBe('2.00');
    expect(toFixedDecimal('1.005', 2)).toBe('1.01');
    expect(toFixedDecimal('1.004999', 2)).toBe('1.00');
    expect(toFixedDecimal('9.995', 2)).toBe('10.00');
    expect(toFixedDecimal('.125', 2)).toBe('0.13');
    expect(toFixedDecimal('12.5', 0)).toBe('13');
  });
  it('keeps the sign away from zero and drops it on zero', () => {
    expect(toFixedDecimal('-1.005', 2)).toBe('-1.01');
    expect(toFixedDecimal('-0.001', 2)).toBe('0.00');
    expect(toFixedDecimal('+3.1', 1)).toBe('3.1');
  });
  it('keeps precision a float would lose', () => {
    expect(toFixedDecimal('99999999999999999999.995', 2)).toBe(
      '100000000000000000000.00',
    );
  });
  it('returns input that is not a plain decimal unchanged', () => {
    expect(toFixedDecimal('abc', 2)).toBe('abc');
    expect(toFixedDecimal('', 2)).toBe('');
  });
});
