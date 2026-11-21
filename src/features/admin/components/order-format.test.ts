import { describe, expect, it } from 'vitest';
import {
  NO_FILTER,
  canReconcile,
  filterCount,
  prettyPayload,
  rangeInvalid,
} from './order-format';

describe('order-format', () => {
  it('offers reconciling only for orders the gateway can still change', () => {
    expect(canReconcile('PENDING')).toBe(true);
    expect(canReconcile('EXPIRED')).toBe(true);
    expect(canReconcile('PAID')).toBe(false);
    expect(canReconcile('FAILED')).toBe(false);
  });

  it('indents a JSON payload and keeps any other text as sent', () => {
    expect(prettyPayload('{"a":1}')).toBe('{\n  "a": 1\n}');
    expect(prettyPayload('code=00')).toBe('code=00');
    expect(prettyPayload('  ')).toBeNull();
    expect(prettyPayload(null)).toBeNull();
  });

  it('flags a first day after the last day only', () => {
    expect(rangeInvalid('2026-11-10', '2026-11-01')).toBe(true);
    expect(rangeInvalid('2026-11-01', '2026-11-01')).toBe(false);
    expect(rangeInvalid('', '2026-11-01')).toBe(false);
    expect(rangeInvalid('2026-11-10', '')).toBe(false);
  });
});

describe('filterCount', () => {
  it('counts each filter in use, the day range once', () => {
    expect(filterCount(NO_FILTER)).toBe(0);
    expect(
      filterCount({
        ...NO_FILTER,
        status: 'PAID',
        from: '2026-11-01',
        to: '2026-11-10',
        manual: true,
      }),
    ).toBe(3);
  });
});
