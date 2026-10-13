import { describe, expect, it } from 'vitest';
import { groupLevels, groupSteps, toStep } from './order-book';

describe('order book grouping', () => {
  it('offers the tick and 10×, 100×, 1000× of a power-of-ten tick', () => {
    expect(groupSteps('0.01000000')).toEqual(['0.01', '0.1', '1', '10']);
    expect(groupSteps('0.00001')).toEqual([
      '0.00001',
      '0.0001',
      '0.001',
      '0.01',
    ]);
    expect(groupSteps('1')).toEqual(['1', '10', '100', '1000']);
    expect(groupSteps('0.5')).toEqual(['0.5']);
    expect(groupSteps(null)).toEqual([]);
  });

  it('rounds bids down and asks up to the step', () => {
    expect(toStep('63000.57', '0.1', false)).toBe('63000.5');
    expect(toStep('63000.57', '0.1', true)).toBe('63000.6');
    expect(toStep('63000.50', '0.1', true)).toBe('63000.5');
    expect(toStep('63007.5', '10', false)).toBe('63000');
    expect(toStep('63007.5', '10', true)).toBe('63010');
    expect(toStep('63000.57', '0.01', true)).toBe('63000.57');
  });

  it('merges levels per step with an exact running total', () => {
    const bids = [
      { price: '63000.57', quantity: '0.1' },
      { price: '63000.51', quantity: '0.2' },
      { price: '63000.49', quantity: '0.30000' },
      { price: '62999.90', quantity: '1' },
    ];
    expect(groupLevels(bids, '0.1', 'bid', 20)).toEqual([
      { price: '63000.5', quantity: '0.3', cumulative: '0.3' },
      { price: '63000.4', quantity: '0.30000', cumulative: '0.60000' },
      { price: '62999.9', quantity: '1', cumulative: '1.60000' },
    ]);
    expect(groupLevels(bids, null, 'bid', 2)).toHaveLength(2);
    const asks = [
      { price: '63000.61', quantity: '0.5' },
      { price: '63000.69', quantity: '0.5' },
    ];
    expect(groupLevels(asks, '0.1', 'ask', 20)).toEqual([
      { price: '63000.7', quantity: '1.0', cumulative: '1.0' },
    ]);
  });
});
