import { describe, expect, it } from 'vitest';
import type { EquityPoint, JournalTrade } from '../../../types/domain';
import { addDays, businessDay, isDay } from '../../../utils/business-day';
import { equityCurve } from './equity-curve';
import { readView, viewFilter, viewParams } from './performance-view';
import { tradeResult } from './trade-result';

const point = (day: string, cumulativeNetPnl: string): EquityPoint => ({
  day,
  trades: 1,
  netPnl: '0',
  cumulativeNetPnl,
});

describe('business days', () => {
  it('rolls over at midnight of UTC+7', () => {
    expect(businessDay(Date.parse('2026-11-05T16:59:59Z'))).toBe('2026-11-05');
    expect(businessDay(Date.parse('2026-11-05T17:00:00Z'))).toBe('2026-11-06');
  });
  it('adds days across a month and refuses a day that does not exist', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(isDay('2026-02-30')).toBe(false);
    expect(isDay('2026-02-28')).toBe(true);
  });
});

describe('performance view', () => {
  const read = (query: string) => readView(new URLSearchParams(query));

  it('defaults to all time on simulated trades, without dates', () => {
    expect(viewFilter(read(''), '2026-11-06', true)).toEqual({
      source: 'SIMULATED',
    });
    expect(viewParams(read('')).toString()).toBe('');
  });

  it('counts today in a preset and sends no `to`', () => {
    expect(viewFilter(read('period=7d'), '2026-11-06', true)).toEqual({
      from: '2026-10-31',
      source: 'SIMULATED',
    });
    expect(viewFilter(read('period=1y'), '2026-11-06', true).from).toBe(
      '2025-11-07',
    );
  });

  it('sends the day after the last one shown as `to`', () => {
    const view = read('from=2026-10-01&to=2026-10-31');
    expect(view.period).toBe('custom');
    expect(viewFilter(view, '2026-11-06', true)).toEqual({
      from: '2026-10-01',
      to: '2026-11-01',
      source: 'SIMULATED',
    });
  });

  it('ignores what the address cannot mean', () => {
    expect(read('period=9d&market=mars&source=x&from=soon')).toMatchObject({
      period: 'all',
      market: 'all',
      source: 'SIMULATED',
      from: '',
    });
  });

  it('keeps every filter through the address', () => {
    const query =
      'period=custom&from=2026-10-01&to=2026-10-31&market=spot&source=ALL&pair=p&strategy=s';
    expect(viewParams(read(query)).toString()).toBe(query);
  });

  it('leaves the strategy out when the plan has no list to choose from', () => {
    expect(viewFilter(read('strategy=s'), '2026-11-06', false)).toEqual({
      source: 'SIMULATED',
    });
  });
});

describe('equity curve', () => {
  it('starts at 0 on `from`', () => {
    const curve = equityCurve([point('2026-11-03', '5')], '2026-11-01');
    expect(curve[0]).toEqual({
      day: '2026-11-01',
      cumulative: '0',
      drawdown: '0',
    });
  });

  it('keeps days unique when the first exit is on `from`', () => {
    const days = equityCurve([point('2026-11-01', '5')], '2026-11-01');
    expect(days.map((each) => each.day)).toEqual(['2026-10-31', '2026-11-01']);
  });

  it('starts the day before the first exit without `from`', () => {
    expect(equityCurve([point('2026-11-03', '5')], null)[0]?.day).toBe(
      '2026-11-02',
    );
  });

  it('measures the drawdown from the peak in exact decimals', () => {
    const curve = equityCurve(
      [
        point('2026-11-01', '0.10000000'),
        point('2026-11-02', '0.30000000'),
        point('2026-11-03', '0.10000000'),
        point('2026-11-04', '-0.20000000'),
      ],
      null,
    );
    expect(curve.map((each) => each.drawdown)).toEqual([
      '0',
      '0',
      '0',
      '-0.2',
      '-0.5',
    ]);
  });

  it('counts a fall below the 0 start as a drawdown', () => {
    expect(equityCurve([point('2026-11-01', '-3')], null)[1]?.drawdown).toBe(
      '-3',
    );
  });

  it('has nothing to draw without an exit', () => {
    expect(equityCurve([], '2026-11-01')).toEqual([]);
  });
});

describe('trade result (BR-42)', () => {
  const closed = (netPnl: string | null, status = 'CLOSED') =>
    ({ netPnl, status }) as JournalTrade;
  it('reads the sign of the net P/L', () => {
    expect(tradeResult(closed('0.00000001'))).toBe('WIN');
    expect(tradeResult(closed('-0.00000001'))).toBe('LOSS');
    expect(tradeResult(closed('0.00000000'))).toBe('BREAKEVEN');
  });
  it('gives an open trade no result', () => {
    expect(tradeResult(closed(null, 'OPEN'))).toBeNull();
  });
});
