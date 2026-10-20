import BigBase from 'big.js';
import { describe, expect, it } from 'vitest';
import {
  add,
  compare,
  divide,
  isPlainDecimal,
  isPositive,
  min,
  multiply,
  percentOf,
  subtract,
  toStep,
} from './decimal-math';

describe('decimal math (D-102, ADR-019)', () => {
  it('reproduces the Spot example of the plan (section 13): buy 0.01 BTC at 60,000', () => {
    // Locked: 0.01 × 60,000 = 600 USDT; received after the 0.1 % fee.
    expect(multiply('0.01', '60000')).toBe('600');
    const fee = multiply('0.01', '0.001');
    expect(fee).toBe('0.00001');
    expect(subtract('0.01', fee)).toBe('0.00999');
  });

  it('adds, subtracts and compares exactly where floats drift', () => {
    expect(add('0.1', '0.2')).toBe('0.3');
    expect(subtract('63000.01', '62999.99')).toBe('0.02');
    expect(compare('0.30', '0.3')).toBe(0);
    expect(compare('1', '0.999999999999')).toBe(1);
    expect(min('2', '1.5')).toBe('1.5');
    expect(isPositive('0')).toBe(false);
  });

  it('divides to a fixed number of digits with an explicit rounding', () => {
    expect(divide('1000', '63000.01', 5)).toBe('0.01587');
    expect(divide('1000', '63000.01', 5, 'up')).toBe('0.01588');
    expect(divide('10', '4')).toBe('2.5');
  });

  it('puts a value on a tick or step, down or up', () => {
    expect(toStep('0.0158730', '0.00001', 'down')).toBe('0.01587');
    expect(toStep('63000.017', '0.01', 'down')).toBe('63000.01');
    expect(toStep('63000.011', '0.01', 'up')).toBe('63000.02');
    expect(toStep('12.5', '1', 'half-up')).toBe('13');
    expect(toStep('0.5', '0.10000000', 'down')).toBe('0.5');
  });

  it('takes a share of a balance, rounded down', () => {
    expect(percentOf('1000', 25, 2)).toBe('250.00');
    expect(percentOf('0.12345', 50, 5)).toBe('0.06172');
  });

  it('accepts only plain non-negative decimals as form input', () => {
    expect(isPlainDecimal('12.50')).toBe(true);
    expect(isPlainDecimal('-1')).toBe(false);
    expect(isPlainDecimal('1e3')).toBe(false);
    expect(isPlainDecimal('.5')).toBe(false);
  });

  it('leaves the library defaults untouched', () => {
    expect(BigBase.DP).toBe(20);
    expect(BigBase.RM).toBe(1);
  });
});
