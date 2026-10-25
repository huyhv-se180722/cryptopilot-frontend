import { describe, expect, it, vi } from 'vitest';
import { createHttpClient } from './http-client';
import type { AccountFeed } from './paper-trading';
import {
  createHttpTradingPlanService,
  createPendingTradingPlanService,
  POSITION_QUEUE,
} from './trading-plan';
import type { PlanInputs } from '../../types/domain';
import {
  decodeCalculation,
  decodeEntryDeviation,
  decodePlan,
  decodePlanPage,
} from './trading-plan-dto';
import { decodeProblem } from './problem';

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

  it('reads the position of an executed plan (103d7cf), null before the fill', () => {
    expect(decodePlan(PLAN).position).toBeNull();
    expect(
      decodePlanPage({
        items: [{ ...ROW, status: 'EXECUTED', positionStatus: 'OPEN' }],
        page: 1,
        pageSize: 20,
        total: 1,
      }).items[0]?.positionStatus,
    ).toBe('OPEN');
    // T-048a only: the TP-E fields read as empty.
    const open = decodePlan({
      ...PLAN,
      status: 'EXECUTED',
      position: {
        status: 'OPEN',
        fillPrice: '100.000000000000',
        quantity: '2.000000000000',
        entryTime: '2026-10-25T08:00:00Z',
        entryFee: '0.20000000',
        liquidationPrice: null,
        currentPrice: '103',
        unrealizedPnl: '6.00000000',
      },
    }).position;
    expect(open).toMatchObject({
      status: 'OPEN',
      unrealizedPnl: '6.00000000',
      provisional: false,
      stopLoss: null,
      levelChangeCount: 0,
      levelChanges: [],
      levelWarnings: [],
    });
    // The CLOSED example of the contract, after one change of the levels.
    const closed = decodePlan({
      ...PLAN,
      status: 'EXECUTED',
      position: {
        status: 'CLOSED',
        fillPrice: '100.000000000000',
        quantity: '2.000000000000',
        entryTime: '2026-10-25T08:01:00Z',
        entryFee: '0.04000000',
        liquidationPrice: '90.370000000000',
        currentPrice: null,
        unrealizedPnl: null,
        exitPrice: '90.370000000000',
        exitTime: '2026-10-25T08:02:00Z',
        closeReason: 'LIQUIDATION',
        realizedPnl: '-19.26000000',
        feeAmount: '0.76296000',
        fundingFeeAmount: '0.00000000',
        netPnl: '-20.02296000',
        provisional: false,
        stopLoss: '97.000000000000',
        takeProfit: '112.000000000000',
        originalStopLoss: '95.000000000000',
        originalTakeProfit: '110.000000000000',
        stopWidened: false,
        levelChangeCount: 1,
        levelChanges: [
          {
            changedAt: '2026-10-25T08:01:30Z',
            oldStopLoss: '95.000000000000',
            oldTakeProfit: '110.000000000000',
            newStopLoss: '97.000000000000',
            newTakeProfit: '112.000000000000',
          },
        ],
        breakevenPrice: null,
        breakevenProvisional: false,
        levelWarnings: [],
        levelsEffectiveFrom: '2026-10-25T08:02:00Z',
      },
    }).position;
    expect(closed).toMatchObject({
      closeReason: 'LIQUIDATION',
      netPnl: '-20.02296000',
      levelChangeCount: 1,
      levelChanges: [{ newStopLoss: '97.000000000000' }],
    });
    expect(() =>
      decodePlan({
        ...PLAN,
        position: { ...closed, closeReason: 'EXPIRED' },
      }),
    ).toThrow();
  });

  it('reads the MSG51 and MSG52 bodies of a moved MARKET entry (TP-C)', () => {
    expect(
      decodeEntryDeviation(
        decodeProblem(
          {
            code: 'ENTRY_DEVIATION_CONFIRMATION_REQUIRED',
            messageCode: 'MSG51',
            messageArgs: ['0.50000000', '0.033300000000', '1.66666667'],
            deviationR: '0.50000000',
            maxDeviationR: '0.75000000',
            expectedFillPrice: '101000',
            positionQuantity: '0.033300000000',
            riskRewardRatio: '1.66666667',
            netRiskReward: '1.49828071',
          },
          400,
        ),
      ),
    ).toEqual({
      kind: 'confirm',
      deviationR: '0.50000000',
      maxDeviationR: '0.75000000',
      expectedFillPrice: '101000',
      positionQuantity: '0.033300000000',
      riskRewardRatio: '1.66666667',
      netRiskReward: '1.49828071',
    });
    expect(
      decodeEntryDeviation(
        decodeProblem(
          {
            status: 409,
            code: 'ENTRY_DEVIATION_REFUSED',
            messageCode: 'MSG52',
            messageArgs: ['1.00000000', '0.75000000'],
            deviationR: '1.00000000',
            maxDeviationR: '0.75000000',
            expectedFillPrice: '102000',
            takeProfitReached: false,
          },
          409,
        ),
      ),
    ).toMatchObject({ kind: 'refused', takeProfitReached: false });
    // Another refusal, or one without its figures, is not a deviation.
    expect(
      decodeEntryDeviation(
        decodeProblem(
          { code: 'TRADING_BLOCKING_WARNING', messageCode: 'MSG18' },
          409,
        ),
      ),
    ).toBeNull();
    expect(
      decodeEntryDeviation(
        decodeProblem(
          { code: 'ENTRY_DEVIATION_REFUSED', messageCode: 'MSG52' },
          409,
        ),
      ),
    ).toBeNull();
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
    await plans.activate(PLAN.id, true);
    await plans.cancel(PLAN.id);
    expect(
      calls.map(
        (call) => call.method + ' ' + call.url.pathname + call.url.search,
      ),
    ).toEqual([
      'GET /api/v1/plans/' + PLAN.id,
      'POST /api/v1/plans/' + PLAN.id + '/activate',
      'POST /api/v1/plans/' + PLAN.id + '/activate?confirmDeviation=true',
      'POST /api/v1/plans/' + PLAN.id + '/cancel',
    ]);
  });

  it('estimates and closes an open position, and listens to its queue (T-046)', async () => {
    const estimate = {
      currentPrice: '103',
      estimatedExitPrice: '102.9',
      priceResult: '5.80000000',
      entryFee: '0.04000000',
      estimatedExitFee: '0.10290000',
      fundingSoFar: '-0.01000000',
      fundingProvisional: true,
      estimatedNetPnl: '5.64710000',
      at: '2026-10-25T09:00:00Z',
    };
    const { plans, calls } = setup(estimate);
    await expect(plans.closeEstimate(PLAN.id)).resolves.toEqual(estimate);
    const closer = setup(PLAN);
    await closer.plans.closePosition(PLAN.id);
    expect(
      [...calls, ...closer.calls].map(
        (call) => call.method + ' ' + call.url.pathname,
      ),
    ).toEqual([
      'GET /api/v1/plans/' + PLAN.id + '/close-estimate',
      'POST /api/v1/plans/' + PLAN.id + '/close-position',
    ]);
    const subscribed: string[] = [];
    const feed: AccountFeed = {
      status: () => 'open',
      onStatus: () => () => undefined,
      subscribeTopic: (destination, decode, listener) => {
        subscribed.push(destination);
        listener(
          decode({
            positionId: 'pos-1',
            planId: PLAN.id,
            market: 'SPOT',
            symbol: 'BTCUSDT',
            status: 'CLOSED',
            closeReason: 'TAKE_PROFIT',
            exitPrice: '110',
            exitTime: '2026-10-25T10:00:00Z',
            realizedPnl: '20.00000000',
            feeAmount: '0.30000000',
            netPnl: '19.70000000',
            provisional: false,
          }),
        );
        return () => undefined;
      },
    };
    const http = createHttpClient({
      baseUrl: 'https://api.example.test/api/v1',
    });
    const received: unknown[] = [];
    createHttpTradingPlanService(http, feed).subscribePositions((update) =>
      received.push(update),
    );
    expect(subscribed).toEqual([POSITION_QUEUE]);
    expect(received).toEqual([
      {
        planId: PLAN.id,
        status: 'CLOSED',
        closeReason: 'TAKE_PROFIT',
        netPnl: '19.70000000',
        provisional: false,
      },
    ]);
  });

  it('moves only the levels given of an open position (TP-E)', async () => {
    const bodies: unknown[] = [];
    const http = createHttpClient({
      baseUrl: 'https://api.example.test/api/v1',
      fetcher: vi.fn<typeof fetch>(async (input, init = {}) => {
        bodies.push({
          method: init.method,
          path: new URL(String(input)).pathname,
          body: JSON.parse(String(init.body)),
        });
        return new Response(JSON.stringify(PLAN), { status: 200 });
      }),
      session: { accessToken: () => 'token-1', refresh: async () => 'renewed' },
    });
    const plans = createHttpTradingPlanService(http);
    await plans.changeLevels(PLAN.id, { stopLoss: '61000', takeProfit: null });
    await plans.changeLevels(PLAN.id, {
      stopLoss: '61000',
      takeProfit: '70000',
    });
    expect(bodies).toEqual([
      {
        method: 'PATCH',
        path: '/api/v1/plans/' + PLAN.id + '/position-levels',
        body: { stopLoss: '61000' },
      },
      {
        method: 'PATCH',
        path: '/api/v1/plans/' + PLAN.id + '/position-levels',
        body: { stopLoss: '61000', takeProfit: '70000' },
      },
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
      // Repeated after MSG51 with the Trader's confirmation (TP-C).
      confirmDeviation: true,
    });
  });
});
