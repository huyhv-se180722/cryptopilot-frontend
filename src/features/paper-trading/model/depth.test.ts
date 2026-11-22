import { describe, expect, it } from 'vitest';
import { depthPath } from './depth';

describe('depth chart path (TR-F2)', () => {
  it('steps up from the best price outwards and closes on the axis', () => {
    const path = depthPath(
      [
        { price: '101', cumulative: '1' },
        { price: '102', cumulative: '3' },
      ],
      100,
      103,
      3,
    );
    expect(path).toBe(
      'M100.00,160 L100.00,160.00 L100.00,106.67 L200.00,106.67 L200.00,0.00 L200.00,160 Z',
    );
  });

  it('draws nothing without levels or a range', () => {
    expect(depthPath([], 0, 1, 1)).toBe('');
    expect(depthPath([{ price: '1', cumulative: '1' }], 1, 1, 1)).toBe('');
  });
});
