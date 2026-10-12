import { describe, expect, it, vi } from 'vitest';
import { createHttpClient } from './http-client';
import {
  createHttpTradingPlanService,
  createPendingTradingPlanService,
} from './trading-plan';
import { decodePlan, decodePlanPage } from './trading-plan-dto';

/** Shapes of `GET /plans` and `GET /plans/{id}` on develop @ 0d92def. */
const ROW = {
  id: '0199a2c4-0000-7000-8000-000000000001',
  pairId: '0199a0f0-1111-7aaa-8bbb-000000000001',
  market: 'SPOT',
  direction: 'LONG',
  entryType: 'LIMIT',
  entryPrice: '62000.00',
  stopLoss: '60000.00',
  takeProfit: '66000.00',
  leverage: null,
  riskAmount: '10.00000000',
  riskRewardRatio: '2.00000000',
  status: 'DRAFT',
  createdAt: '2026-10-03T02:20:00Z',
  activatedAt: null,
  expiresAt: '2026-10-10T02:20:00Z',
};

const PLAN = {
  ...ROW,
  market: 'FUTURES',
  direction: 'SHORT',
  leverage: 5,
  capital: '1000',
  riskPercent: '1',
  marginMode: 'ISOLATED',
  note: null,
  editable: true,
  snapshot: {
    positionQuantity: '0.010',
    notionalValue: '620.00000000',
    initialMargin: '124.00000000',
    maintenanceMarginRateUsed: '0.004',
    riskAmount: '10.00000000',
    rewardAmount: '20.00000000',
    riskRewardRatio: '2.00000000',
    estimatedLiquidationPrice: '74103.1',
  },
  warnings: [
    {
      type: 'HIGH_LEVERAGE',
      severity: 'WARNING',
      message: 'leverage 5x is above the risk profile maximum of 3x',
    },
  ],
  blocksActivation: false,
  statusHistory: [{ status: 'DRAFT', at: '2026-10-03T02:20:00Z' }],
};

describe('trading plan decoders', () => {
  it('decodes a page of rows without a symbol (FEQ-01)', () => {
    const page = decodePlanPage({
      items: [ROW],
      page: 1,
      pageSize: 20,
      total: 1,
    });
    expect(page.total).toBe(1);
    expect(page.items[0]).toMatchObject({
      market: 'spot',
      leverage: null,
      status: 'DRAFT',
      riskRewardRatio: '2.00000000',
    });
    expect(page.items[0]).not.toHaveProperty('symbol');
  });

  it('keeps the snapshot as decimal strings and words warnings by type', () => {
    const plan = decodePlan(PLAN);
    expect(plan.market).toBe('futures');
    expect(plan.snapshot.estimatedLiquidationPrice).toBe('74103.1');
    expect(plan.warnings).toEqual([
      { type: 'HIGH_LEVERAGE', severity: 'WARNING' },
    ]);
    expect(plan.statusHistory).toEqual([
      { status: 'DRAFT', at: '2026-10-03T02:20:00Z' },
    ]);
  });

  it('decodes a Spot snapshot without margin, MMR or liquidation', () => {
    const plan = decodePlan({
      ...PLAN,
      market: 'SPOT',
      leverage: null,
      marginMode: null,
      snapshot: {
        ...PLAN.snapshot,
        initialMargin: null,
        maintenanceMarginRateUsed: null,
        estimatedLiquidationPrice: null,
      },
    });
    expect(plan.snapshot).toMatchObject({
      initialMargin: null,
      maintenanceMarginRateUsed: null,
      estimatedLiquidationPrice: null,
    });
  });

  it('rejects an unknown status, warning or a missing snapshot value', () => {
    expect(() => decodePlan({ ...PLAN, status: 'OPEN' })).toThrow();
    expect(() =>
      decodePlan({
        ...PLAN,
        warnings: [{ type: 'NEW_RULE', severity: 'INFO' }],
      }),
    ).toThrow();
    expect(() =>
      decodePlan({
        ...PLAN,
        snapshot: { ...PLAN.snapshot, riskAmount: null },
      }),
    ).toThrow();
  });
});

describe('HTTP trading plan adapter', () => {
  function setup(reply: unknown) {
    const calls: { url: URL; method: string; auth: string | null }[] = [];
    const http = createHttpClient({
      baseUrl: 'https://api.example.test/api/v1',
      fetcher: vi.fn<typeof fetch>(async (input, init = {}) => {
        calls.push({
          url: new URL(String(input)),
          method: init.method ?? 'GET',
          auth: new Headers(init.headers).get('Authorization'),
        });
        return new Response(JSON.stringify(reply), { status: 200 });
      }),
      session: { accessToken: () => 'token-1', refresh: async () => 'renewed' },
    });
    return { plans: createHttpTradingPlanService(http), calls };
  }

  it('lists a tab with the upper-case market and the period start', async () => {
    const { plans, calls } = setup({
      items: [],
      page: 2,
      pageSize: 20,
      total: 21,
    });
    await plans.list({
      tab: 'CANCELLED_EXPIRED',
      market: 'futures',
      from: '2026-09-09T00:00:00.000Z',
      page: 2,
      pageSize: 20,
    });
    const url = calls[0]?.url;
    expect(url?.pathname).toBe('/api/v1/plans');
    expect(Object.fromEntries(url?.searchParams ?? [])).toEqual({
      tab: 'CANCELLED_EXPIRED',
      market: 'FUTURES',
      from: '2026-09-09T00:00:00.000Z',
      page: '2',
      pageSize: '20',
    });
    expect(calls[0]?.auth).toBe('Bearer token-1');
  });

  it('reads, activates and cancels one plan', async () => {
    const { plans, calls } = setup(PLAN);
    await plans.get(PLAN.id);
    await plans.activate(PLAN.id);
    await plans.cancel(PLAN.id);
    expect(calls.map((call) => call.method + ' ' + call.url.pathname)).toEqual([
      'GET /api/v1/plans/' + PLAN.id,
      'POST /api/v1/plans/' + PLAN.id + '/activate',
      'POST /api/v1/plans/' + PLAN.id + '/cancel',
    ]);
  });

  it('is pending while no API is configured', async () => {
    await expect(
      createPendingTradingPlanService().get('x'),
    ).rejects.toMatchObject({ code: 'NOT_CONFIGURED' });
  });
});
