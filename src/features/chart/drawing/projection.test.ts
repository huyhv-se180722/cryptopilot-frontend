import { describe, expect, it } from 'vitest';
import { roundPrice, scalePrice } from './projection';

describe('scalePrice', () => {
  it('moves a price by a fraction of itself at the precision', () => {
    expect(scalePrice('100.00', -0.01, 2)).toBe('99.00');
    expect(scalePrice('100.00', 0.02, 2)).toBe('102.00');
  });

  it('moves by one tick at least when the step rounds back onto the price', () => {
    // 1% of 50 is 0.5, which rounds to 50 (or 51) at no decimals.
    expect(scalePrice('50', -0.01, 0)).toBe('49');
    expect(scalePrice('50', 0.01, 0)).toBe('51');
  });

  it('never goes to 0 or below', () => {
    expect(scalePrice('1', -0.01, 0)).toBe(roundPrice(0, 0));
    expect(roundPrice(0, 0)).toBe('1');
  });
});
