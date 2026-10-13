import { describe, expect, it } from 'vitest';
import { chartOffsetSeconds, chartTime, zoneLabel } from './chart-time';

describe('chart time', () => {
  it('moves intraday times by the local offset and keeps daily ones in UTC', () => {
    const at = new Date('2026-10-13T00:00:00Z');
    const local = -at.getTimezoneOffset() * 60;
    expect(chartOffsetSeconds('1h', at)).toBe(local);
    expect(chartOffsetSeconds('15m', at)).toBe(local);
    expect(chartOffsetSeconds('intraday', at)).toBe(local);
    expect(chartOffsetSeconds('1d', at)).toBe(0);
    expect(chartTime('2026-10-13T00:00:00Z', 25_200)).toBe(
      Date.UTC(2026, 9, 13) / 1000 + 25_200,
    );
  });

  it('names the zone the axis shows', () => {
    expect(zoneLabel(0)).toBe('UTC');
    expect(zoneLabel(7 * 3600)).toBe('UTC+7');
    expect(zoneLabel(5.5 * 3600)).toBe('UTC+5:30');
    expect(zoneLabel(-3.5 * 3600)).toBe('UTC-3:30');
    expect(zoneLabel(-5 * 3600)).toBe('UTC-5');
  });
});
