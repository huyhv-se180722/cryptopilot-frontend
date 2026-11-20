import { describe, expect, it } from 'vitest';
import type { FallbackCandle } from '../../../services/api/market-status';
import { referenceBars } from './reference-bars';

const minute = (
  openTime: string,
  open: string,
  high: string,
  low: string,
  close: string,
): FallbackCandle => ({
  openTime,
  open,
  high,
  low,
  close,
  volume: '1',
  closed: true,
});

describe('reference bars (D-159, Q5)', () => {
  it('merges the minutes of each UTC bucket: first open, highest high, lowest low, last close', () => {
    const bars = referenceBars(
      [
        minute('2026-11-19T07:58:00Z', '100', '101', '99', '100.5'),
        minute('2026-11-19T07:59:00Z', '100.5', '104', '100', '103'),
        minute('2026-11-19T08:00:00Z', '103', '103.5', '97.25', '98'),
        minute('2026-11-19T08:01:00Z', '98', '99', '98', '98.75'),
      ],
      '1h',
    );

    expect(bars).toEqual([
      {
        openTime: '2026-11-19T07:00:00.000Z',
        open: '100',
        high: '104',
        low: '99',
        close: '103',
        baseVolume: '0',
        quoteVolume: '0',
      },
      {
        openTime: '2026-11-19T08:00:00.000Z',
        open: '103',
        high: '103.5',
        low: '97.25',
        close: '98.75',
        baseVolume: '0',
        quoteVolume: '0',
      },
    ]);
  });

  it('keeps fifteen-minute buckets apart, and gives nothing for no minute', () => {
    expect(
      referenceBars(
        [
          minute('2026-11-19T08:14:00Z', '1', '1', '1', '1'),
          minute('2026-11-19T08:15:00Z', '2', '2', '2', '2'),
        ],
        '15m',
      ).map((bar) => bar.openTime),
    ).toEqual(['2026-11-19T08:00:00.000Z', '2026-11-19T08:15:00.000Z']);
    expect(referenceBars([], '1d')).toEqual([]);
  });
});
