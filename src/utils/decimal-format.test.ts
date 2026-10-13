import { describe, expect, it } from 'vitest';
import {
  compactDecimal,
  compareDecimal,
  decimalPlaces,
  formatPrice,
  fractionToPercent,
  groupThousands,
  shiftDecimal,
  addDecimal,
  subtractDecimal,
  toFixedDecimal,
  trimDecimal,
} from './decimal-format';

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

describe('trimDecimal', () => {
  it('drops the zeros a database scale adds, keeping a minimum', () => {
    expect(trimDecimal('80000.000000000000', 2)).toBe('80000.00');
    expect(trimDecimal('0.085110000000', 2)).toBe('0.08511');
    expect(trimDecimal('0.005000000000', 0)).toBe('0.005');
    expect(trimDecimal('12.000', 0)).toBe('12');
    expect(trimDecimal('-1.50', 0)).toBe('-1.5');
    expect(trimDecimal('7', 2)).toBe('7.00');
  });
  it('never rounds and returns input that is not a plain decimal unchanged', () => {
    expect(trimDecimal('1.123456789012', 2)).toBe('1.123456789012');
    expect(trimDecimal('abc', 2)).toBe('abc');
  });
});

describe('market display helpers', () => {
  it('reads precision from a tick size and formats prices with it', () => {
    expect(decimalPlaces('0.01000000')).toBe(2);
    expect(decimalPlaces('1.00000000')).toBe(0);
    expect(decimalPlaces(null)).toBe(0);
    expect(formatPrice('63000.016', '0.01')).toBe('63,000.02');
    expect(formatPrice('0.52', '0.0001')).toBe('0.5200');
    expect(groupThousands('-1234567.5')).toBe('-1,234,567.5');
  });

  it('turns a funding fraction into a percent exactly', () => {
    expect(shiftDecimal('0.00010000', 2)).toBe('0.010000');
    expect(fractionToPercent('0.00010000', 4)).toBe('0.0100');
    expect(fractionToPercent('-0.000075', 4)).toBe('-0.0075');
  });

  it('compacts volumes without a float', () => {
    expect(compactDecimal('1139455120.42')).toBe('1.14B');
    expect(compactDecimal('18234.11')).toBe('18.23K');
    expect(compactDecimal('999.5')).toBe('999.50');
    expect(compactDecimal('12345678901234567890')).toBe('12345678.90T');
  });

  it('orders decimal strings', () => {
    const values = ['10', '-2.5', '0.000', '9.99', '-10', '10.0001', '-0'];
    expect([...values].sort(compareDecimal)).toEqual([
      '-10',
      '-2.5',
      '0.000',
      '-0',
      '9.99',
      '10',
      '10.0001',
    ]);
  });
});

describe('subtractDecimal', () => {
  it('subtracts exactly across different scales and signs', () => {
    expect(subtractDecimal('63000.01', '63000.00')).toBe('0.01');
    expect(subtractDecimal('0.1', '0.3')).toBe('-0.2');
    expect(subtractDecimal('1', '0.0001')).toBe('0.9999');
    expect(subtractDecimal('-1.5', '-2')).toBe('0.5');
    expect(subtractDecimal('99999999999999999999.99999999', '0.00000001')).toBe(
      '99999999999999999999.99999998',
    );
  });
});

describe('addDecimal', () => {
  it('adds exactly whatever the scales and signs', () => {
    expect(addDecimal('0.1', '0.2')).toBe('0.3');
    expect(addDecimal('1.25000', '0.75')).toBe('2.00000');
    expect(addDecimal('-1.5', '0.5')).toBe('-1.0');
    expect(addDecimal('12', '-12.00')).toBe('0.00');
    expect(addDecimal('99999999999999999.99', '0.01')).toBe(
      '100000000000000000.00',
    );
  });
});
