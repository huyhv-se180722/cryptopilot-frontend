import { describe, expect, it, vi } from 'vitest';
import { createHttpClient } from './http-client';
import {
  createHttpTradingPlanService,
  createPendingTradingPlanService,
} from './trading-plan';
import type { PlanInputs } from '../../types/domain';
import {
  decodeCalculation,
  decodePlan,
  decodePlanPage,
} from './trading-plan-dto';

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

  it('reads the plan validity fields of TP-A (112aa24), and null without them', () => {
    const invalidated = decodePlan({
      ...PLAN,
      entryType: 'STOP',
      status: 'INVALIDATED',
      plannedEntryPrice: '62000.00',
      invalidationPrice: '60500.00',
      maxEntryDeviationR: '0.50000000',
      analysisTimeframe: '4h',
      invalidationReason: 'INVALIDATION_PRICE',
      setupScoreAtPlan: '59.00',
      setupScorePreset: 'DAY_TRADING v1',
      statusHistory: [
        { status: 'DRAFT', at: '2026-10-03T02:20:00Z' },
        { status: 'ACTIVE', at: '2026-10-03T02:30:00Z' },
        { status: 'INVALIDATED', at: '2026-10-04T09:00:00Z' },
      ],
    });
    expect(invalidated).toMatchObject({
      entryType: 'STOP',
      status: 'INVALIDATED',
      invalidationPrice: '60500.00',
      maxEntryDeviationR: '0.50000000',
      analysisTimeframe: '4h',
      invalidationReason: 'INVALIDATION_PRICE',
      setupScoreAtPlan: '59.00',
      setupScorePreset: 'DAY_TRADING v1',
    });
    expect(
      decodePlanPage({
        items: [
          {
            ...ROW,
            status: 'INVALIDATED',
            invalidatedAt: '2026-10-04T09:00:00Z',
            invalidationReason: 'TAKE_PROFIT_REACHED',
          },
        ],
        page: 1,
        pageSize: 20,
        total: 1,
      }).items[0],
    ).toMatchObject({
      invalidatedAt: '2026-10-04T09:00:00Z',
      invalidationReason: 'TAKE_PROFIT_REACHED',
    });
    // A backend without TP-A sends none of them.
    expect(decodePlan(PLAN)).toMatchObject({
      plannedEntryPrice: null,
      invalidationPrice: null,
      maxEntryDeviationR: null,
      analysisTimeframe: null,
      invalidationReason: null,
      setupScoreAtPlan: null,
      setupScorePreset: null,
    });
    expect(() => decodePlan({ ...PLAN, analysisTimeframe: '5m' })).toThrow();
    expect(() =>
      decodePlan({ ...PLAN, invalidationReason: 'PRICE_MOVED' }),
    ).toThrow();
  });

  it('reads the expected fill and the costs of D-116 (dccfc6c), and null without them', () => {
    const costs = {
      estimatedEntryFee: '10.00000000',
      estimatedStopLossExitFee: '9.95000000',
      estimatedTakeProfitExitFee: '4.06000000',
      estimatedSlippage: '0.00000000',
      lossAtStopLoss: '119.95000000',
      feeShareOfRisk: '0.19950000',
      netRiskReward: '2.38382659',
    };
    const plan = decodePlan({
      ...PLAN,
      entryType: 'MARKET',
      expectedFillPrice: '62031.00',
      snapshot: { ...PLAN.snapshot, ...costs },
      warnings: [
        { type: 'HIGH_FEE_SHARE', severity: 'WARNING', message: 'dev text' },
      ],
    });
    expect(plan.expectedFillPrice).toBe('62031.00');
    expect(plan.snapshot).toMatchObject(costs);
    expect(plan.warnings).toEqual([
      { type: 'HIGH_FEE_SHARE', severity: 'WARNING' },
    ]);
    const [row] = decodePlanPage({
      items: [{ ...ROW, expectedFillPrice: null }],
      page: 1,
      pageSize: 20,
      total: 1,
    }).items;
    expect(row?.expectedFillPrice).toBeNull();

    const older = decodePlan(PLAN);
    expect(older.expectedFillPrice).toBeNull();
    expect(older.snapshot.lossAtStopLoss).toBeNull();
    expect(older.snapshot.netRiskReward).toBeNull();
    expect(() =>
      decodePlan({
        ...PLAN,
        snapshot: { ...PLAN.snapshot, lossAtStopLoss: 119.95 },
      }),
    ).toThrow();
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

  it('lists a tab of one pair with the upper-case market and the period start', async () => {
    const { plans, calls } = setup({
      items: [],
      page: 2,
      pageSize: 20,
      total: 21,
    });
    await plans.list({
      tab: 'CANCELLED_EXPIRED',
      pairId: 'pair-1',
      market: 'futures',
      from: '2026-09-09T00:00:00.000Z',
      page: 2,
      pageSize: 20,
    });
    const url = calls[0]?.url;
    expect(url?.pathname).toBe('/api/v1/plans');
    expect(Object.fromEntries(url?.searchParams ?? [])).toEqual({
      tab: 'CANCELLED_EXPIRED',
      pairId: 'pair-1',
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

  it('calculates with the pair and saves a DRAFT with or without activation', async () => {
    const inputs: PlanInputs = {
      market: 'spot',
      direction: 'LONG',
      entryType: 'LIMIT',
      entryPrice: '62000',
      stopLoss: '60000',
      takeProfit: '66000',
      riskPercent: '1',
      leverage: null,
      expiresAt: null,
      note: null,
      invalidationPrice: null,
      maxEntryDeviationR: null,
      analysisTimeframe: null,
    };
    const calc = setup({
      entryPrice: '62000.00',
      capital: '1000',
      riskPercent: '1',
      snapshot: { ...PLAN.snapshot, initialMargin: null },
      warnings: [],
      blocksActivation: false,
    });
    await calc.plans.calculate(PLAN.pairId, inputs);
    expect(calc.calls[0]?.method).toBe('POST');
    expect(calc.calls[0]?.url.pathname).toBe('/api/v1/plans/calculate');
    const saved = setup(PLAN);
    await saved.plans.update(PLAN.id, inputs, true);
    expect(saved.calls[0]?.method).toBe('PUT');
    expect(saved.calls[0]?.url.pathname).toBe('/api/v1/plans/' + PLAN.id);
    const created = setup(PLAN);
    await created.plans.create(PLAN.pairId, inputs, false);
    expect(created.calls[0]?.method).toBe('POST');
    expect(created.calls[0]?.url.pathname).toBe('/api/v1/plans');
  });

  it('is pending while no API is configured', async () => {
    await expect(
      createPendingTradingPlanService().get('x'),
    ).rejects.toMatchObject({ code: 'NOT_CONFIGURED' });
  });
});

describe('plan calculation', () => {
  it('decodes the risk panel and sends the market in upper case', async () => {
    const result = decodeCalculation({
      entryPrice: '62000.00',
      capital: '1000',
      riskPercent: '1',
      snapshot: { ...PLAN.snapshot, initialMargin: null },
      warnings: [{ type: 'LOW_RR', severity: 'WARNING', message: 'dev text' }],
      blocksActivation: false,
    });
    expect(result.snapshot.initialMargin).toBeNull();
    expect(result.warnings).toEqual([{ type: 'LOW_RR', severity: 'WARNING' }]);
    expect(() =>
      decodeCalculation({ ...result, blocksActivation: 'no' }),
    ).toThrow();

    const bodies: unknown[] = [];
    const http = createHttpClient({
      baseUrl: 'https://api.example.test/api/v1',
      fetcher: vi.fn<typeof fetch>(async (_input, init = {}) => {
        bodies.push(JSON.parse(String(init.body)));
        return new Response(JSON.stringify(PLAN), { status: 200 });
      }),
      session: { accessToken: () => 'token-1', refresh: async () => 'renewed' },
    });
    await createHttpTradingPlanService(http).update(
      PLAN.id,
      {
        market: 'futures',
        direction: 'SHORT',
        entryType: 'MARKET',
        entryPrice: null,
        stopLoss: '63000',
        takeProfit: '59000',
        riskPercent: null,
        leverage: 5,
        expiresAt: null,
        note: 'retest',
        invalidationPrice: null,
        maxEntryDeviationR: '0.5',
        analysisTimeframe: '1h',
      },
      false,
    );
    expect(bodies[0]).toEqual({
      market: 'FUTURES',
      direction: 'SHORT',
      entryType: 'MARKET',
      entryPrice: null,
      stopLoss: '63000',
      takeProfit: '59000',
      riskPercent: null,
      leverage: 5,
      expiresAt: null,
      note: 'retest',
      invalidationPrice: null,
      maxEntryDeviationR: '0.5',
      analysisTimeframe: '1h',
      activate: false,
    });
    // A new plan names its pair and asks for activation the same way.
    await createHttpTradingPlanService(http).create(
      PLAN.pairId,
      {
        market: 'spot',
        direction: 'LONG',
        entryType: 'STOP',
        entryPrice: '61000',
        stopLoss: '59000',
        takeProfit: '67000',
        riskPercent: '1',
        leverage: null,
        expiresAt: null,
        note: null,
        invalidationPrice: '58500',
        maxEntryDeviationR: null,
        analysisTimeframe: null,
      },
      true,
    );
    expect(bodies[1]).toEqual({
      pairId: PLAN.pairId,
      market: 'SPOT',
      direction: 'LONG',
      entryType: 'STOP',
      entryPrice: '61000',
      stopLoss: '59000',
      takeProfit: '67000',
      riskPercent: '1',
      leverage: null,
      expiresAt: null,
      note: null,
      invalidationPrice: '58500',
      maxEntryDeviationR: null,
      analysisTimeframe: null,
      activate: true,
    });
  });
});
