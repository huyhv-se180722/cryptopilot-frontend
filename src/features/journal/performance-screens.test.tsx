// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PerformancePage } from '../../pages/trader/PerformancePage';
import { ServiceError } from '../../services/api/errors';
import type { PerformanceService } from '../../services/api/contracts';
import type { PerformanceAdvanced, Session } from '../../types/domain';
import type {
  PerformanceBreakdownRow,
  PerformanceSummary,
} from '../../types/domain';
import { page, renderRoutes, fakeAuth, testTrader } from '../../test/render';

const line = vi.hoisted(() => ({ setData: vi.fn() }));
vi.mock('lightweight-charts', () => ({
  ColorType: { Solid: 'solid' },
  CrosshairMode: { Normal: 0 },
  LineStyle: { Dashed: 2, Solid: 0 },
  LineSeries: {},
  createChart: () => ({
    addSeries: () => line,
    timeScale: () => ({ fitContent: vi.fn() }),
    remove: vi.fn(),
  }),
}));

const session = (features: readonly string[]): Session => ({
  ...testTrader,
  entitlements: {
    tier: features.length ? 'PRO' : 'FREE',
    features,
    limits: {},
  } as unknown as Session['entitlements'],
});
const FREE = session([]);
const PRO = session(['ADVANCED_PERFORMANCE']);

const SUMMARY: PerformanceSummary = {
  from: null,
  to: '2026-11-07',
  trades: 4,
  wins: 2,
  losses: 1,
  breakeven: 1,
  winRate: '0.66666667',
  totalNetPnl: '1234.50000000',
  provisionalTrades: 0,
  totalFees: '3.20000000',
  totalFunding: '-0.75000000',
  advanced: null,
};
const ADVANCED: PerformanceAdvanced = {
  averageWin: '20.00000000',
  averageLoss: '-10.00000000',
  profitFactor: null,
  averagePlannedRiskReward: '2.50000000',
  averageRealizedR: null,
  tradesWithR: 0,
  largestWin: '30.00000000',
  largestLoss: '-10.00000000',
  maxConsecutiveLosses: 1,
  maxDrawdown: '10.00000000',
  averageEntryDeviationR: null,
  costOfLateEntryR: null,
  averageMaeR: null,
  averageMfeR: null,
};
const ROW: PerformanceBreakdownRow = {
  key: null,
  label: 'Unassigned',
  trades: 2,
  wins: 1,
  losses: 1,
  breakeven: 0,
  winRate: null,
  netPnl: '-5.00000000',
  profitFactor: null,
  averageRealizedR: null,
};

function service(overrides: Partial<PerformanceService> = {}) {
  return {
    summary: vi.fn(async () => SUMMARY),
    breakdown: vi.fn(async () => [ROW]),
    equityCurve: vi.fn(async () => [
      {
        day: '2026-11-01',
        trades: 1,
        netPnl: '5.00000000',
        cumulativeNetPnl: '5.00000000',
      },
    ]),
    ...overrides,
  } satisfies PerformanceService;
}

const refusal = (fieldErrors: Record<string, string>, status = 400) =>
  new ServiceError('refused', 'HTTP_ERROR', status, {
    status,
    code: status === 403 ? 'PLAN_FEATURE_NOT_INCLUDED' : 'VALIDATION_FAILED',
    messageCode: status === 403 ? 'MSG29' : 'MSG01',
    messageArgs: status === 403 ? ['PREMIUM'] : [],
    fieldErrors,
  });

function open(
  performance: PerformanceService,
  who: Session,
  path = '/performance',
) {
  return renderRoutes(
    [page('/performance', <PerformancePage />)],
    path,
    fakeAuth({ restoreSession: async () => who }),
    { performance },
  );
}

describe('SCR-23 performance dashboard', () => {
  it('shows FREE its fields and locks, and never calls the paid reads', async () => {
    const performance = service();
    await open(performance, FREE);
    expect(await screen.findByText('Total net P/L')).toBeTruthy();
    expect(screen.getByText('+1,234.50 USDT')).toBeTruthy();
    expect(screen.getByText('66.67%')).toBeTruthy();
    expect(screen.getByText('Wins 2 · Losses 1 · Breakeven 1')).toBeTruthy();
    expect(screen.getAllByRole('link', { name: 'View plans' })).toHaveLength(3);
    expect(screen.queryByLabelText('Strategy')).toBeNull();
    expect(performance.breakdown).not.toHaveBeenCalled();
    expect(performance.equityCurve).not.toHaveBeenCalled();
  });

  it('names the market rows from the copy, not the API', async () => {
    const performance = service({
      summary: vi.fn(async () => ({ ...SUMMARY, advanced: ADVANCED })),
      breakdown: vi.fn(async () => [{ ...ROW, key: 'SPOT', label: 'SPOT' }]),
    });
    await open(performance, PRO);
    const markets = await screen.findByRole('region', { name: 'By market' });
    expect(await within(markets).findByText('Spot')).toBeTruthy();
    expect(within(markets).queryByText('SPOT')).toBeNull();
  });

  it('shows PRO the metrics, curve and breakdowns, a dash for each null', async () => {
    const performance = service({
      summary: vi.fn(async () => ({ ...SUMMARY, advanced: ADVANCED })),
    });
    await open(performance, PRO);
    expect(await screen.findByText('Advanced metrics')).toBeTruthy();
    const metrics = screen.getByRole('heading', { name: 'Advanced metrics' })
      .parentElement as HTMLElement;
    const factor = within(metrics).getByText('Profit factor');
    expect(factor.parentElement?.textContent).toBe('Profit factor—');
    const coins = await screen.findByRole('region', { name: 'By strategy' });
    expect(await within(coins).findByText('Unassigned')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'View plans' })).toBeNull();
    expect(
      new Set(
        vi.mocked(performance.breakdown).mock.calls.map(([kind]) => kind),
      ),
    ).toEqual(new Set(['coin', 'strategy', 'market']));
    await waitFor(() => expect(line.setData).toHaveBeenCalled());
    expect(line.setData.mock.calls[0]?.[0]).toHaveLength(2);
    expect(line.setData.mock.calls[0]?.[0][0]).toMatchObject({ value: 0 });
  });

  it('shows the lock when the server refuses a paid read', async () => {
    const performance = service({
      summary: vi.fn(async () => ({ ...SUMMARY, advanced: ADVANCED })),
      breakdown: vi.fn(async () => {
        throw refusal({}, 403);
      }),
    });
    await open(performance, PRO);
    expect(
      (await screen.findAllByText(/available on the PREMIUM plan/)).length,
    ).toBeGreaterThan(0);
  });

  it('answers an empty result with MSG41 and no error', async () => {
    const performance = service({
      summary: vi.fn(async () => ({
        ...SUMMARY,
        trades: 0,
        wins: 0,
        losses: 0,
        breakeven: 0,
        winRate: null,
      })),
    });
    await open(performance, FREE);
    expect(await screen.findByText('No results found.')).toBeTruthy();
    expect(screen.queryByText('Total net P/L')).toBeNull();
  });

  it('badges provisional trades', async () => {
    await open(
      service({
        summary: vi.fn(async () => ({ ...SUMMARY, provisionalTrades: 2 })),
      }),
      FREE,
    );
    expect(
      await screen.findByText('Includes provisional trades: 2'),
    ).toBeTruthy();
  });

  it('places 400 MSG15 under From, its limits filled by the client', async () => {
    const performance = service({
      summary: vi.fn(async () => {
        throw refusal({ from: 'MSG15' });
      }),
    });
    await open(
      performance,
      FREE,
      '/performance?period=custom&from=2026-11-05&to=2026-11-01',
    );
    expect(
      await screen.findByText(
        'From must be between the first trade and 2026-11-01.',
      ),
    ).toBeTruthy();
    expect(performance.summary).toHaveBeenCalledWith(
      {
        from: '2026-11-05',
        to: '2026-11-02',
        source: 'SIMULATED',
      },
      expect.anything(),
    );
  });

  it('shows no raw server text on a failure', async () => {
    await open(
      service({
        summary: vi.fn(async () => {
          throw new ServiceError('raw stack', 'NETWORK_ERROR');
        }),
      }),
      FREE,
    );
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.queryByText('raw stack')).toBeNull();
  });

  it('reads the filters of the address and sends a new period', async () => {
    const user = userEvent.setup();
    const performance = service();
    await open(
      performance,
      FREE,
      '/performance?market=futures&source=ALL&pair=p-9',
    );
    await screen.findByText('Total net P/L');
    expect(performance.summary).toHaveBeenLastCalledWith(
      { market: 'futures', source: 'ALL', pairId: 'p-9' },
      expect.anything(),
    );
    await user.click(screen.getByRole('radio', { name: '7D' }));
    await waitFor(() =>
      expect(
        vi.mocked(performance.summary).mock.calls.at(-1)?.[0],
      ).toHaveProperty('from'),
    );
  });
});
