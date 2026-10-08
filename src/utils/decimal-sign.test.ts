import { describe, expect, it } from 'vitest';
import { signOf, withSign } from './decimal-sign';

describe('signOf', () => {
  it('detects zero in any decimal spelling', () => {
    for (const value of ['0', '0.00', '-0', '+0.000', '.0', '000'])
      expect(signOf(value)).toBe('zero');
  });
  it('detects positive and negative values without float conversion', () => {
    expect(signOf('0.000000000001')).toBe('positive');
    expect(signOf('-12.5')).toBe('negative');
    expect(signOf('+3')).toBe('positive');
  });
});

describe('withSign', () => {
  it('prefixes positives only', () => {
    expect(withSign('2.35')).toBe('+2.35');
    expect(withSign('+2.35')).toBe('+2.35');
    expect(withSign('-1.20')).toBe('-1.20');
    expect(withSign('0.00')).toBe('0.00');
  });
});
