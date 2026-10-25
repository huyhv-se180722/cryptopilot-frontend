import { describe, expect, it, vi } from 'vitest';
import { createHttpClient } from './http-client';
import {
  createHttpTradingPlanService,
  createPendingTradingPlanService,
} from './trading-plan';
import type { PlanInputs } from '../../types/domain';
import { problemOf } from './errors';
import {
  decodeCalculation,
  decodeDeviation,
  decodePlan,
  decodePlanPage,
} from './trading-plan-dto';

/**
 * Wire shapes from the FE guide `modules/trading-plan.md` (2026-10-25):
 * the `GET /plans` row, the `GET /plans/{id}` body with the TP-A / TP-0 /
 * T-048a fields, and the `/plans/calculate` answer.
 */
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
  positionStatus: null,
};

/** The TP-0 example of the guide (Futures LONG MARKET, 100,000 / 99,500 / 101,500). */
const FEES = {
  estimatedEntryFee: '10.00000000',
  estimatedStopLossExitFee: '9.95000000',
  estimatedTakeProfitExitFee: '4.06000000',
  estimatedSlippage: '0.00000000',
  lossAtStopLoss: '119.95000000',
  feeShareOfRisk: '0.19950000',
  netRiskReward: '2.38382659',
};

const PLAN = {
  ...ROW,
  market: 'FUTURES',
  direction: 'SHORT',
  leverage: 5,
  expectedFillPrice: null,
  plannedEntryPrice: '62000.00',
  capital: '1000',
  riskPercent: '1',
  marginMode: 'ISOLATED',
  note: null,
  invalidationPrice: null,
  maxEntryDeviationR: null,
  analysisTimeframe: '1h',
  invalidationReason: null,
  setupScoreAtPlan: null,
  setupScorePreset: null,
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
    ...FEES,
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
  position: null,
};

/** The T-048a OPEN example and the T-048b CLOSED (liquidation) example. */
const OPEN_POSITION = {
  status: 'OPEN',
  fillPrice: '100.000000000000',
  quantity: '2.000000000000',
  entryTime: '2026-10-25T08:00:00Z',
  entryFee: '0.20000000',
  liquidationPrice: null,
  currentPrice: '103',
  unrealizedPnl: '6.00000000',
};
const CLOSED_POSITION = {
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
};

const INPUTS: PlanInputs = {
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
  invalidationPrice: '64000',
  maxEntryDeviationR: '0.5',
  analysisTimeframe: '4h',
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
      expectedFillPrice: null,
      invalidatedAt: null,
      invalidationReason: null,
      positionStatus: null,
    });
    expect(page.items[0]).not.toHaveProperty('symbol');
  });

  it.each([
    'TAKE_PROFIT_REACHED',
    'STOP_LOSS_REACHED',
    'INVALIDATION_PRICE',
  ] as const)('decodes an INVALIDATED row with %s', (reason) => {
    const [row] = decodePlanPage({
      items: [
        {
          ...ROW,
          status: 'INVALIDATED',
          activatedAt: '2026-10-03T03:00:00Z',
          invalidatedAt: '2026-10-04T05:00:00Z',
          invalidationReason: reason,
        },
      ],
      page: 1,
      pageSize: 20,
      total: 1,
    }).items;
    expect(row).toMatchObject({
      status: 'INVALIDATED',
      invalidatedAt: '2026-10-04T05:00:00Z',
      invalidationReason: reason,
    });
  });

  it('decodes a STOP entry and an EXECUTED row with its position status', () => {
    const page = decodePlanPage({
      items: [
        { ...ROW, entryType: 'STOP' },
        { ...ROW, status: 'EXECUTED', positionStatus: 'OPEN' },
        { ...ROW, status: 'EXECUTED', positionStatus: 'CLOSED' },
      ],
      page: 1,
      pageSize: 20,
      total: 3,
    });
    expect(page.items.map((row) => row.entryType)).toEqual([
      'STOP',
      'LIMIT',
      'LIMIT',
    ]);
    expect(page.items.map((row) => row.positionStatus)).toEqual([
      null,
      'OPEN',
      'CLOSED',
    ]);
  });

  it('keeps the snapshot as decimal strings and words warnings by type', () => {
    const plan = decodePlan(PLAN);
    expect(plan.market).toBe('futures');
    expect(plan.snapshot.estimatedLiquidationPrice).toBe('74103.1');
    expect(plan.snapshot).toMatchObject(FEES);
    expect(plan.warnings).toEqual([
      { type: 'HIGH_LEVERAGE', severity: 'WARNING' },
    ]);
    expect(plan.statusHistory).toEqual([
      { status: 'DRAFT', at: '2026-10-03T02:20:00Z' },
    ]);
    expect(plan).toMatchObject({
      analysisTimeframe: '1h',
      plannedEntryPrice: '62000.00',
      setupScoreAtPlan: null,
      position: null,
    });
  });

  it('reads the TP-0 figures as null on a plan saved before TP-0', () => {
    const plan = decodePlan({
      ...PLAN,
      snapshot: Object.fromEntries(
        Object.entries(PLAN.snapshot).map(([key, value]) => [
          key,
          key in FEES ? null : value,
        ]),
      ),
    });
    expect(plan.snapshot.lossAtStopLoss).toBeNull();
    expect(plan.snapshot.netRiskReward).toBeNull();
    expect(plan.snapshot.feeShareOfRisk).toBeNull();
  });

  it('decodes the TP-A fields: STOP, invalidation, deviation limit, score', () => {
    const plan = decodePlan({
      ...PLAN,
      entryType: 'STOP',
      status: 'ACTIVE',
      invalidationPrice: '61000.00',
      maxEntryDeviationR: '0.50',
      analysisTimeframe: '4h',
      setupScoreAtPlan: '59.00',
      setupScorePreset: 'DAY_TRADING v1',
    });
    expect(plan).toMatchObject({
      entryType: 'STOP',
      invalidationPrice: '61000.00',
      maxEntryDeviationR: '0.50',
      analysisTimeframe: '4h',
      setupScoreAtPlan: '59.00',
      setupScorePreset: 'DAY_TRADING v1',
    });
  });

  it.each([
    'TAKE_PROFIT_REACHED',
    'STOP_LOSS_REACHED',
    'INVALIDATION_PRICE',
  ] as const)('decodes an INVALIDATED plan with %s', (reason) => {
    const plan = decodePlan({
      ...PLAN,
      status: 'INVALIDATED',
      editable: false,
      invalidationReason: reason,
      statusHistory: [
        { status: 'DRAFT', at: '2026-10-03T02:20:00Z' },
        { status: 'ACTIVE', at: '2026-10-03T03:00:00Z' },
        { status: 'INVALIDATED', at: '2026-10-04T05:00:00Z' },
      ],
    });
    expect(plan.invalidationReason).toBe(reason);
    expect(plan.statusHistory.at(-1)?.status).toBe('INVALIDATED');
  });

  it('decodes a MARKET plan whose expected fill differs from its reference price', () => {
    const plan = decodePlan({
      ...PLAN,
      entryType: 'MARKET',
      entryPrice: '100000.0',
      expectedFillPrice: '100010.0',
      plannedEntryPrice: '100000.0',
    });
    expect(plan.entryPrice).toBe('100000.0');
    expect(plan.expectedFillPrice).toBe('100010.0');
  });

  it('decodes an EXECUTED plan with the OPEN position of the guide', () => {
    const plan = decodePlan({
      ...PLAN,
      status: 'EXECUTED',
      editable: false,
      position: OPEN_POSITION,
    });
    expect(plan.position).toEqual({
      status: 'OPEN',
      fillPrice: '100.000000000000',
      quantity: '2.000000000000',
      entryTime: '2026-10-25T08:00:00Z',
      entryFee: '0.20000000',
      liquidationPrice: null,
      currentPrice: '103',
      unrealizedPnl: '6.00000000',
      // Absent before T-048b: read as null.
      exitPrice: null,
      exitTime: null,
      closeReason: null,
      realizedPnl: null,
      feeAmount: null,
      fundingFeeAmount: null,
      netPnl: null,
      provisional: false,
    });
  });

  it('decodes a position without a cached price as null, not 0', () => {
    const plan = decodePlan({
      ...PLAN,
      status: 'EXECUTED',
      position: { ...OPEN_POSITION, currentPrice: null, unrealizedPnl: null },
    });
    expect(plan.position?.currentPrice).toBeNull();
    expect(plan.position?.unrealizedPnl).toBeNull();
  });

  it('decodes the CLOSED position of the guide (a liquidation)', () => {
    const plan = decodePlan({
      ...PLAN,
      status: 'EXECUTED',
      position: CLOSED_POSITION,
    });
    expect(plan.position).toMatchObject({
      status: 'CLOSED',
      closeReason: 'LIQUIDATION',
      netPnl: '-20.02296000',
      provisional: false,
      currentPrice: null,
    });
    expect(() =>
      decodePlan({
        ...PLAN,
        position: { ...CLOSED_POSITION, closeReason: 'MARGIN_CALL' },
      }),
    ).toThrow();
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

  it('keeps a warning type it does not know, with its severity (ADR-009)', () => {
    const plan = decodePlan({
      ...PLAN,
      warnings: [
        { type: 'HIGH_FEE_SHARE', severity: 'WARNING', message: 'x' },
        { type: 'NEW_RULE', severity: 'INFO', message: 'y' },
      ],
    });
    expect(plan.warnings).toEqual([
      { type: 'HIGH_FEE_SHARE', severity: 'WARNING' },
      { type: 'UNKNOWN', severity: 'INFO', rawType: 'NEW_RULE' },
    ]);
    // The severity still has to be one of the three.
    expect(() =>
      decodePlan({
        ...PLAN,
        warnings: [{ type: 'NEW_RULE', severity: 'CRITICAL' }],
      }),
    ).toThrow();
  });

  it('rejects an unknown status, entry type, reason or a missing value', () => {
    expect(() => decodePlan({ ...PLAN, status: 'OPEN' })).toThrow();
    expect(() => decodePlan({ ...PLAN, entryType: 'TRAILING' })).toThrow();
    expect(() =>
      decodePlan({ ...PLAN, invalidationReason: 'TIME_PASSED' }),
    ).toThrow();
    expect(() => decodePlan({ ...PLAN, analysisTimeframe: '5m' })).toThrow();
    expect(() =>
      decodePlanPage({
        items: [{ ...ROW, status: 'ARCHIVED' }],
        page: 1,
        pageSize: 20,
        total: 1,
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
    const calls: {
      url: URL;
      method: string;
      auth: string | null;
      body: unknown;
    }[] = [];
    const http = createHttpClient({
      baseUrl: 'https://api.example.test/api/v1',
      fetcher: vi.fn<typeof fetch>(async (input, init = {}) => {
        calls.push({
          url: new URL(String(input)),
          method: init.method ?? 'GET',
          auth: new Headers(init.headers).get('Authorization'),
          body: init.body ? JSON.parse(String(init.body)) : undefined,
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
    const calc = setup({
      entryPrice: '62000.00',
      expectedFillPrice: null,
      capital: '1000',
      riskPercent: '1',
      snapshot: { ...PLAN.snapshot, initialMargin: null },
      warnings: [],
      blocksActivation: false,
    });
    await calc.plans.calculate(PLAN.pairId, INPUTS);
    expect(calc.calls[0]?.method).toBe('POST');
    expect(calc.calls[0]?.url.pathname).toBe('/api/v1/plans/calculate');
    const saved = setup(PLAN);
    await saved.plans.update(PLAN.id, INPUTS, true);
    expect(saved.calls[0]?.method).toBe('PUT');
    expect(saved.calls[0]?.url.pathname).toBe('/api/v1/plans/' + PLAN.id);
    const created = setup(PLAN);
    await created.plans.create(PLAN.pairId, INPUTS, false);
    expect(created.calls[0]?.method).toBe('POST');
    expect(created.calls[0]?.url.pathname).toBe('/api/v1/plans');
  });

  it('sends the TP-A fields and no capital (TP-D)', async () => {
    const { plans, calls } = setup(PLAN);
    await plans.create(PLAN.pairId, { ...INPUTS, entryType: 'STOP' }, false);
    expect(calls[0]?.body).toEqual({
      pairId: PLAN.pairId,
      market: 'SPOT',
      direction: 'LONG',
      entryType: 'STOP',
      entryPrice: '62000',
      stopLoss: '60000',
      takeProfit: '66000',
      riskPercent: '1',
      leverage: null,
      expiresAt: null,
      note: null,
      invalidationPrice: '64000',
      maxEntryDeviationR: '0.5',
      analysisTimeframe: '4h',
      activate: false,
    });
    expect(calls[0]?.body).not.toHaveProperty('capital');
  });

  it('never sends an entry or an invalidation price for MARKET', async () => {
    const { plans, calls } = setup(PLAN);
    await plans.update(
      PLAN.id,
      {
        ...INPUTS,
        market: 'futures',
        direction: 'SHORT',
        entryType: 'MARKET',
        entryPrice: '1',
        stopLoss: '63000',
        takeProfit: '59000',
        leverage: 5,
      },
      false,
    );
    expect(calls[0]?.body).toMatchObject({
      market: 'FUTURES',
      entryType: 'MARKET',
      entryPrice: null,
      invalidationPrice: null,
      leverage: 5,
      activate: false,
    });
  });

  it('is pending while no API is configured', async () => {
    await expect(
      createPendingTradingPlanService().get('x'),
    ).rejects.toMatchObject({ code: 'NOT_CONFIGURED' });
  });
});

describe('plan calculation', () => {
  it('decodes the guide’s risk panel with the fee figures', () => {
    const result = decodeCalculation({
      entryPrice: '62000.00',
      expectedFillPrice: null,
      capital: '1000.00000000',
      riskPercent: '1',
      snapshot: {
        positionQuantity: '0.00500',
        notionalValue: '310.0000000',
        initialMargin: '310.00000000',
        maintenanceMarginRateUsed: null,
        riskAmount: '10.00000000',
        rewardAmount: '20.00000000',
        riskRewardRatio: '2.00000000',
        estimatedLiquidationPrice: null,
        estimatedEntryFee: '0.31000000',
        estimatedStopLossExitFee: '0.30000000',
        estimatedTakeProfitExitFee: '0.33000000',
        estimatedSlippage: '0.00000000',
        lossAtStopLoss: '10.61000000',
        feeShareOfRisk: '0.06100000',
        netRiskReward: '1.82469369',
      },
      warnings: [{ type: 'LOW_RR', severity: 'WARNING', message: 'dev text' }],
      blocksActivation: false,
    });
    expect(result.snapshot.lossAtStopLoss).toBe('10.61000000');
    expect(result.snapshot.netRiskReward).toBe('1.82469369');
    expect(result.expectedFillPrice).toBeNull();
    expect(result.warnings).toEqual([{ type: 'LOW_RR', severity: 'WARNING' }]);
    expect(() =>
      decodeCalculation({ ...result, blocksActivation: 'no' }),
    ).toThrow();
  });

  it('decodes the expected fill of a MARKET entry', () => {
    const result = decodeCalculation({
      entryPrice: '100000.0',
      expectedFillPrice: '100010.0',
      capital: '1000',
      riskPercent: '1',
      snapshot: PLAN.snapshot,
      warnings: [{ type: 'HIGH_FEE_SHARE', severity: 'WARNING' }],
      blocksActivation: false,
    });
    expect(result.expectedFillPrice).toBe('100010.0');
    expect(result.warnings[0]?.type).toBe('HIGH_FEE_SHARE');
  });
});

describe('entry deviation at MARKET activation (TP-C)', () => {
  /** The MSG51 and MSG52 bodies of the guide. */
  const MSG51 = {
    type: 'about:blank',
    title: 'Bad Request',
    status: 400,
    detail:
      'the MARKET entry moved 0.50000000R from the plan and needs confirmation',
    code: 'ENTRY_DEVIATION_CONFIRMATION_REQUIRED',
    messageCode: 'MSG51',
    traceId: 'trace-1',
    messageArgs: ['0.50000000', '0.033300000000', '1.66666667'],
    deviationR: '0.50000000',
    maxDeviationR: '0.75000000',
    expectedFillPrice: '101000',
    positionQuantity: '0.033300000000',
    riskRewardRatio: '1.66666667',
    netRiskReward: '1.49828071',
  };
  const MSG52 = {
    status: 409,
    code: 'ENTRY_DEVIATION_REFUSED',
    messageCode: 'MSG52',
    messageArgs: ['1.00000000', '0.75000000'],
    deviationR: '1.00000000',
    maxDeviationR: '0.75000000',
    expectedFillPrice: '102000',
    takeProfitReached: false,
  };

  function setup(status: number, reply: unknown) {
    const calls: { url: URL; body: unknown }[] = [];
    const http = createHttpClient({
      baseUrl: 'https://api.example.test/api/v1',
      fetcher: vi.fn<typeof fetch>(async (input, init = {}) => {
        calls.push({
          url: new URL(String(input)),
          body: init.body ? JSON.parse(String(init.body)) : undefined,
        });
        return new Response(JSON.stringify(reply), { status });
      }),
      session: { accessToken: () => 'token-1', refresh: async () => 'renewed' },
    });
    return { plans: createHttpTradingPlanService(http), calls };
  }

  it('reads the MSG51 body into the dialog values, never its developer text', async () => {
    const { plans } = setup(400, MSG51);
    const error = await plans.activate(PLAN.id).catch((caught) => caught);
    const problem = problemOf(error);
    expect(problem?.messageArgs).toEqual(MSG51.messageArgs);
    expect(problem?.extensions).not.toHaveProperty('detail');
    expect(problem?.extensions).not.toHaveProperty('title');
    expect(decodeDeviation(problem)).toEqual({
      deviationR: '0.50000000',
      maxDeviationR: '0.75000000',
      expectedFillPrice: '101000',
      positionQuantity: '0.033300000000',
      riskRewardRatio: '1.66666667',
      netRiskReward: '1.49828071',
      takeProfitReached: false,
    });
  });

  it('reads the MSG52 body with takeProfitReached', async () => {
    const { plans } = setup(409, { ...MSG52, takeProfitReached: true });
    const error = await plans.activate(PLAN.id).catch((caught) => caught);
    expect(decodeDeviation(problemOf(error))).toMatchObject({
      deviationR: '1.00000000',
      positionQuantity: null,
      takeProfitReached: true,
    });
  });

  it('is no deviation for another refusal or a body without its members', () => {
    expect(
      decodeDeviation({
        status: 409,
        code: 'PLAN_LIMIT_REACHED',
        messageCode: 'MSG27',
        messageArgs: [],
        fieldErrors: {},
        extensions: { deviationR: '1' },
      }),
    ).toBeNull();
    expect(
      decodeDeviation({
        status: 400,
        code: 'ENTRY_DEVIATION_CONFIRMATION_REQUIRED',
        messageCode: 'MSG51',
        messageArgs: [],
        fieldErrors: {},
      }),
    ).toBeNull();
  });

  it('confirms Activate with the query parameter, and only when asked', async () => {
    const { plans, calls } = setup(200, PLAN);
    await plans.activate(PLAN.id);
    await plans.activate(PLAN.id, true);
    expect(calls[0]?.url.search).toBe('');
    expect(calls[0]?.body).toBeUndefined();
    expect(calls[1]?.url.pathname).toBe(
      '/api/v1/plans/' + PLAN.id + '/activate',
    );
    expect(calls[1]?.url.search).toBe('?confirmDeviation=true');
    expect(calls[1]?.body).toBeUndefined();
  });

  it('confirms Save and Activate in the body, and never for a draft save', async () => {
    const { plans, calls } = setup(200, PLAN);
    await plans.create(PLAN.pairId, INPUTS, true, true);
    await plans.update(PLAN.id, INPUTS, true, true);
    await plans.update(PLAN.id, INPUTS, true);
    await plans.update(PLAN.id, INPUTS, false, true);
    expect(calls[0]?.body).toMatchObject({
      activate: true,
      confirmDeviation: true,
    });
    expect(calls[1]?.body).toMatchObject({
      activate: true,
      confirmDeviation: true,
    });
    expect(calls[2]?.body).not.toHaveProperty('confirmDeviation');
    expect(calls[3]?.body).not.toHaveProperty('confirmDeviation');
    expect(calls.every((call) => call.url.search === '')).toBe(true);
  });
});
