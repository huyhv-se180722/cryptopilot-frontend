import { describe, expect, it, vi } from 'vitest';
import type { HttpClient } from './http-client';
import { createHttpJournalService } from './journal';
import { createHttpPerformanceService } from './performance';
import {
  decodeEquityCurve,
  decodePerformanceBreakdown,
  decodePerformanceSummary,
} from './performance-dto';

const SUMMARY = {
  from: null,
  to: '2026-11-07',
  trades: 3,
  wins: 1,
  losses: 1,
  breakeven: 1,
  winRate: '0.50000000',
  totalNetPnl: '3.25000000',
  provisionalTrades: 1,
  totalFees: '0.75000000',
  totalFunding: '-0.10000000',
  advanced: null,
};
const ADVANCED = {
  averageWin: '5.00000000',
  averageLoss: '-1.75000000',
  profitFactor: null,
  averagePlannedRiskReward: null,
  averageRealizedR: '0.50000000',
  tradesWithR: 2,
  largestWin: '5.00000000',
  largestLoss: '-1.75000000',
  maxConsecutiveLosses: 1,
  maxDrawdown: '1.75000000',
  averageEntryDeviationR: null,
  costOfLateEntryR: null,
  averageMaeR: null,
  averageMfeR: null,
};

function client(answer: unknown = []) {
  const request = vi.fn(
    async ({ decode }: { decode: (body: unknown) => unknown }) =>
      decode(answer),
  );
  return { http: { request } as unknown as HttpClient, request };
}

describe('performance decoders', () => {
  it('keeps decimals as strings and a null `advanced` for FREE', () => {
    const summary = decodePerformanceSummary(SUMMARY);
    expect(summary.totalNetPnl).toBe('3.25000000');
    expect(summary.from).toBeNull();
    expect(summary.advanced).toBeNull();
  });

  it('reads the advanced block with its null ratios', () => {
    const { advanced } = decodePerformanceSummary({
      ...SUMMARY,
      advanced: ADVANCED,
    });
    expect(advanced).toMatchObject({
      profitFactor: null,
      averageMaeR: null,
      tradesWithR: 2,
    });
  });

  it('accepts null where the OpenAPI promises a value', () => {
    expect(
      decodePerformanceSummary({ ...SUMMARY, totalNetPnl: null, winRate: null })
        .totalNetPnl,
    ).toBeNull();
  });

  it('refuses a decimal sent as a number', () => {
    expect(() =>
      decodePerformanceSummary({ ...SUMMARY, totalNetPnl: 3.25 }),
    ).toThrow();
  });

  it('reads the Unassigned row with its null key', () => {
    const [row] = decodePerformanceBreakdown([
      {
        key: null,
        label: 'Unassigned',
        trades: 1,
        wins: 0,
        losses: 1,
        breakeven: 0,
        winRate: '0.00000000',
        netPnl: '-1.00000000',
        profitFactor: null,
        averageRealizedR: null,
      },
    ]);
    expect(row).toMatchObject({ key: null, label: 'Unassigned' });
  });

  it('names a pair by its id when by-coin has no label for it', () => {
    const [row] = decodePerformanceBreakdown([
      {
        key: 'pair-gone',
        label: null,
        trades: 1,
        wins: 1,
        losses: 0,
        breakeven: 0,
        winRate: '1.00000000',
        netPnl: '1.00000000',
        profitFactor: null,
        averageRealizedR: null,
      },
    ]);
    expect(row).toMatchObject({ key: 'pair-gone', label: 'pair-gone' });
  });

  it('reads the points of the curve', () => {
    expect(
      decodeEquityCurve([
        {
          day: '2026-11-01',
          trades: 2,
          netPnl: '1.00000000',
          cumulativeNetPnl: '1.00000000',
        },
      ])[0],
    ).toMatchObject({ day: '2026-11-01', cumulativeNetPnl: '1.00000000' });
  });
});

describe('performance requests', () => {
  it('sends every filter on the wire spelling', async () => {
    const { http, request } = client(SUMMARY);
    await createHttpPerformanceService(http).summary({
      from: '2026-10-01',
      to: '2026-11-01',
      market: 'futures',
      source: 'ALL',
      pairId: 'p',
      strategyId: 's',
    });
    expect(request.mock.calls[0]?.[0]).toMatchObject({
      path: 'journal/performance/summary?source=ALL&from=2026-10-01&to=2026-11-01&market=FUTURES&pairId=p&strategyId=s',
    });
  });

  it('names each breakdown and the curve', async () => {
    const { http, request } = client([]);
    const service = createHttpPerformanceService(http);
    const filter = { source: 'SIMULATED' } as const;
    await service.breakdown('coin', filter);
    await service.breakdown('strategy', filter);
    await service.breakdown('market', filter);
    await service.equityCurve(filter);
    expect(request.mock.calls.map(([call]) => (call as never)['path'])).toEqual(
      [
        'journal/performance/by-coin?source=SIMULATED',
        'journal/performance/by-strategy?source=SIMULATED',
        'journal/performance/by-market?source=SIMULATED',
        'journal/performance/equity-curve?source=SIMULATED',
      ],
    );
  });

  it('sends the market of the journal list', async () => {
    const { http, request } = client({
      items: [],
      page: 1,
      pageSize: 10,
      total: 0,
    });
    await createHttpJournalService(http).list({
      page: 1,
      pageSize: 10,
      market: 'spot',
    });
    expect(request.mock.calls[0]?.[0]).toMatchObject({
      path: 'journal?page=1&pageSize=10&market=SPOT',
    });
  });
});
