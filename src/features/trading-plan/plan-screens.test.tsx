// @vitest-environment jsdom
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlanCreatePage } from '../../pages/trader/PlanCreatePage';
import { PlanDetailPage } from '../../pages/trader/PlanDetailPage';
import { PlanEditPage } from '../../pages/trader/PlanEditPage';
import { PlansPage } from '../../pages/trader/PlansPage';
import { devProfile, devRiskParams } from '../../dev/fixtures/profile';
import type {
  MarketService,
  ProfileService,
  TradingPlanService,
} from '../../services/api/contracts';
import { ServiceError } from '../../services/api/errors';
import type {
  MarketPair,
  MarketType,
  PlanEntitlements,
  Session,
  TradingPlan,
  TradingPlanSummary,
} from '../../types/domain';
import { fakeAuth, page, renderRoutes, testTrader } from '../../test/render';

const priceLines: string[] = [];
vi.mock('lightweight-charts', () => ({
  createSeriesMarkers: () => ({ setMarkers: vi.fn() }),
  CandlestickSeries: { name: 'candles' },
  LineSeries: { name: 'line' },
  HistogramSeries: { name: 'histogram' },
  ColorType: { Solid: 'solid' },
  createChart: () => ({
    addSeries: () => ({
      setData: vi.fn(),
      priceScale: () => ({ applyOptions: vi.fn() }),
      priceToCoordinate: vi.fn(() => null),
      createPriceLine: vi.fn((line: { title: string; price: number }) => {
        priceLines.push(`${line.title} ${line.price}`);
        return line;
      }),
      removePriceLine: vi.fn(),
    }),
    panes: () => [0, 1, 2, 3].map(() => ({ setStretchFactor: vi.fn() })),
    timeScale: () => ({
      fitContent: vi.fn(),
      getVisibleLogicalRange: () => null,
      setVisibleLogicalRange: vi.fn(),
      subscribeVisibleLogicalRangeChange: vi.fn(),
      unsubscribeVisibleLogicalRangeChange: vi.fn(),
    }),
    remove: vi.fn(),
  }),
}));

// jsdom has no modal dialog; the component only needs open/close.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
});

// The editor refuses an expiry that has passed, so the draft expires a week
// after the run rather than on a fixed day that the calendar overtakes.
const EXPIRES_AT = new Date(Date.now() + 7 * 86_400_000).toISOString();

const ROW: TradingPlanSummary = {
  id: '0199a2c4-0000-7000-8000-00000000a1b2',
  pairId: '0199a0f0-1111-7aaa-8bbb-000000000001',
  market: 'futures',
  direction: 'SHORT',
  entryType: 'LIMIT',
  entryPrice: '62000.000000000000',
  expectedFillPrice: null,
  stopLoss: '63000.000000000000',
  takeProfit: '59000.000000000000',
  leverage: 5,
  riskAmount: '10.00000000',
  riskRewardRatio: '3.00000000',
  status: 'DRAFT',
  createdAt: '2026-10-08T02:20:00Z',
  activatedAt: null,
  expiresAt: EXPIRES_AT,
  invalidatedAt: null,
  invalidationReason: null,
  positionStatus: null,
};

const PLAN: TradingPlan = {
  id: ROW.id,
  pairId: ROW.pairId,
  market: 'futures',
  direction: 'SHORT',
  entryType: 'LIMIT',
  entryPrice: '62000.000000000000',
  expectedFillPrice: null,
  stopLoss: '63000.000000000000',
  takeProfit: '59000.000000000000',
  capital: '1000',
  riskPercent: '1',
  leverage: 5,
  marginMode: 'ISOLATED',
  expiresAt: EXPIRES_AT,
  note: 'Retest of the range high.',
  plannedEntryPrice: '62000.000000000000',
  invalidationPrice: null,
  maxEntryDeviationR: null,
  analysisTimeframe: '1h',
  status: 'DRAFT',
  invalidationReason: null,
  setupScoreAtPlan: null,
  setupScorePreset: null,
  editable: true,
  snapshot: {
    positionQuantity: '0.010000000000',
    notionalValue: '620.00000000',
    initialMargin: '124.00000000',
    maintenanceMarginRateUsed: '0.004',
    riskAmount: '10.00000000',
    rewardAmount: '30.00000000',
    riskRewardRatio: '3.00000000',
    estimatedLiquidationPrice: '74103.100000000000',
    estimatedEntryFee: null,
    estimatedStopLossExitFee: null,
    estimatedTakeProfitExitFee: null,
    estimatedSlippage: null,
    lossAtStopLoss: null,
    feeShareOfRisk: null,
    netRiskReward: null,
  },
  warnings: [
    { type: 'HIGH_LEVERAGE', severity: 'WARNING' },
    { type: 'WIDE_STOP_LOSS', severity: 'INFO' },
  ],
  blocksActivation: false,
  statusHistory: [{ status: 'DRAFT', at: '2026-10-08T02:20:00Z' }],
  position: null,
};

const refusal = (
  status: number,
  code: string,
  messageCode: string,
  args: string[] = [],
) =>
  new ServiceError('refused', 'HTTP_ERROR', status, {
    status,
    code,
    messageCode,
    messageArgs: args,
    fieldErrors: {},
  });

/** A 400 with one field error, as the backend answers MSG16 on a field. */
const fieldRefusal = (field: string) =>
  new ServiceError('refused', 'HTTP_ERROR', 400, {
    status: 400,
    code: 'VALIDATION_FAILED',
    messageCode: 'MSG01',
    messageArgs: [],
    fieldErrors: { [field]: 'MSG16' },
  });

const plan = (tier: 'FREE' | 'PRO'): PlanEntitlements => ({
  tier,
  features: tier === 'FREE' ? [] : ['FUTURES_ANALYSIS'],
  limits: { ACTIVE_PLAN_MAX: tier === 'FREE' ? 3 : null },
});

function fakePlans(overrides: Partial<TradingPlanService> = {}) {
  const service: TradingPlanService = {
    list: vi.fn(async (query) =>
      query.tab === 'ACTIVE' && query.pageSize === 1
        ? { items: [], page: 1, pageSize: 1, total: 2 }
        : { items: [ROW], page: query.page, pageSize: 20, total: 1 },
    ),
    get: vi.fn(async () => PLAN),
    activate: vi.fn(async () => ({
      ...PLAN,
      status: 'ACTIVE' as const,
      editable: false,
      statusHistory: [
        ...PLAN.statusHistory,
        { status: 'ACTIVE' as const, at: '2026-10-09T02:20:00Z' },
      ],
    })),
    cancel: vi.fn(async () => ({
      ...PLAN,
      status: 'CANCELLED' as const,
      editable: false,
    })),
    create: vi.fn(async () => PLAN),
    calculate: vi.fn(async () => ({
      entryPrice: PLAN.entryPrice,
      expectedFillPrice: null,
      capital: PLAN.capital,
      riskPercent: PLAN.riskPercent,
      snapshot: PLAN.snapshot,
      warnings: PLAN.warnings,
      blocksActivation: PLAN.blocksActivation,
    })),
    update: vi.fn(async () => PLAN),
    ...overrides,
  };
  return service;
}

const btc = (market: MarketType): MarketPair => ({
  pairId: ROW.pairId,
  symbol: 'BTCUSDT',
  market,
  baseAsset: 'BTC',
  quoteAsset: 'USDT',
  baseAssetName: 'Bitcoin',
  logoUrl: null,
  tickSize: market === 'spot' ? '0.01' : '0.10',
  stepSize: '0.001',
  minNotional: '5',
  displayOrder: 1,
});
const eth: MarketPair = {
  ...btc('spot'),
  pairId: 'eth-id',
  symbol: 'ETHUSDT',
  baseAsset: 'ETH',
  baseAssetName: 'Ethereum',
  displayOrder: 2,
};

/** BTC on both markets with the plans' pair id; ETH on Spot only. */
const fakeMarket = (): MarketService => ({
  listPairs: vi.fn(async (market: MarketType) =>
    market === 'spot' ? [btc('spot'), eth] : [btc('futures')],
  ),
  getCandles: vi.fn(async () =>
    [0, 1, 2].map((i) => ({
      openTime: new Date(Date.UTC(2026, 9, 9, i)).toISOString(),
      open: '62000',
      high: '62100',
      low: '61900',
      close: '62050',
      baseVolume: '10',
      quoteVolume: '620500',
    })),
  ),
  getFuturesMetrics: vi.fn(),
  getTicker: vi.fn(async () => null),
});

async function open(
  path: string,
  service = fakePlans(),
  tier: 'FREE' | 'PRO' = 'FREE',
  market = fakeMarket(),
  profile?: ProfileService,
) {
  const session: Session = { ...testTrader, entitlements: plan(tier) };
  await renderRoutes(
    [
      page('/plans', <PlansPage />),
      page('/plans/new', <PlanCreatePage />),
      page('/plans/:planId', <PlanDetailPage />),
      page('/plans/:planId/edit', <PlanEditPage />),
    ],
    path,
    fakeAuth({ restoreSession: async () => session }),
    { tradingPlan: service, market, ...(profile ? { profile } : {}) },
  );
  return service;
}

const lastList = (service: TradingPlanService) =>
  vi
    .mocked(service.list)
    .mock.calls.map(([query]) => query)
    .filter((query) => query.pageSize !== 1)
    .at(-1);

describe('SCR-16 plan list (T-041)', () => {
  it('lists the rows with direction, prices and status, and links to the plan', async () => {
    await open('/plans');
    const table = within(
      await screen.findByRole('region', { name: 'Draft trading plans' }),
    );
    const row = (await table.findByText('Short')).closest('tr') as HTMLElement;
    const cells = within(row);
    expect(cells.getByText('Futures · 5x')).toBeTruthy();
    expect(cells.getByText('62,000.00')).toBeTruthy();
    expect(cells.getByText('3.00')).toBeTruthy();
    expect(cells.getByText('Draft')).toBeTruthy();
    expect(
      cells
        .getByRole('link', { name: 'Open plan 0000a1b2' })
        .getAttribute('href'),
    ).toBe('/plans/' + ROW.id);
    // The pair is named from the market lists by its id (FEQ-01).
    expect(await cells.findByText('BTC/USDT')).toBeTruthy();
  });

  it('lists an INVALIDATED plan with its reason in the Cancelled / Expired tab (BR-68)', async () => {
    const invalidated: TradingPlanSummary = {
      ...ROW,
      status: 'INVALIDATED',
      invalidatedAt: '2026-10-09T02:20:00Z',
      invalidationReason: 'TAKE_PROFIT_REACHED',
    };
    const service = fakePlans({
      list: vi.fn(async (query) =>
        query.tab === 'CANCELLED_EXPIRED'
          ? { items: [invalidated], page: 1, pageSize: 20, total: 1 }
          : { items: [], page: query.page, pageSize: 20, total: 0 },
      ),
    });
    await open('/plans', service);
    await userEvent.click(
      await screen.findByRole('tab', { name: 'Cancelled / Expired' }),
    );
    const row = (await screen.findByText('Invalidated')).closest(
      'tr',
    ) as HTMLElement;
    expect(
      within(row).getByText('Take profit reached before the entry'),
    ).toBeTruthy();
  });

  it('filters the list by pair (FEQ-01)', async () => {
    const service = await open('/plans');
    await screen.findByText('Short');
    const pair = screen.getByLabelText('Pair');
    await waitFor(() =>
      expect(
        within(pair)
          .getAllByRole('option')
          .map((option) => option.textContent),
      ).toEqual(['All pairs', 'BTC/USDT', 'ETH/USDT']),
    );
    await userEvent.selectOptions(pair, ROW.pairId);
    await waitFor(() => expect(lastList(service)?.pairId).toBe(ROW.pairId));
    await userEvent.click(screen.getByRole('button', { name: 'Reset' }));
    await waitFor(() => expect(lastList(service)?.pairId).toBeUndefined());
  });

  it('shows a dash for a pair the market lists no longer give', async () => {
    const market = fakeMarket();
    vi.mocked(market.listPairs).mockResolvedValue([eth]);
    await open('/plans', fakePlans(), 'FREE', market);
    const row = (await screen.findByText('Short')).closest('tr') as HTMLElement;
    await waitFor(() =>
      expect(
        within(screen.getByLabelText('Pair')).getAllByRole('option'),
      ).toHaveLength(2),
    );
    expect(within(row).getByTitle('Pair name not available')).toBeTruthy();
  });

  it('reads the chosen tab, market and period', async () => {
    const service = await open('/plans');
    await screen.findByText('Short');
    expect(lastList(service)).toMatchObject({ tab: 'DRAFT', page: 1 });
    await userEvent.click(screen.getByRole('tab', { name: 'Active' }));
    await waitFor(() => expect(lastList(service)?.tab).toBe('ACTIVE'));
    await userEvent.selectOptions(screen.getByLabelText('Market'), 'futures');
    await waitFor(() => expect(lastList(service)?.market).toBe('futures'));
    await userEvent.click(screen.getByRole('radio', { name: '30D' }));
    await waitFor(() => {
      const from = Date.parse(lastList(service)?.from ?? '');
      expect((Date.now() - from) / 86_400_000).toBeCloseTo(30, 1);
    });
    await userEvent.click(screen.getByRole('button', { name: 'Reset' }));
    await waitFor(() => {
      expect(lastList(service)?.market).toBeUndefined();
      expect(lastList(service)?.from).toBeUndefined();
      expect(lastList(service)?.tab).toBe('ACTIVE');
    });
  });

  it('shows the active plan limit on FREE only', async () => {
    await open('/plans');
    expect(
      await screen.findByText('2 of 3 active plans on the FREE plan.'),
    ).toBeTruthy();
  });

  it('has no limit banner on a plan without a limit', async () => {
    const service = await open('/plans', fakePlans(), 'PRO');
    await screen.findByText('Short');
    expect(screen.queryByText(/active plans on the/)).toBeNull();
    expect(
      vi.mocked(service.list).mock.calls.some(([q]) => q.pageSize === 1),
    ).toBe(false);
  });

  it('shows the position status on the Executed tab and pages by 20', async () => {
    const service = fakePlans({
      list: vi.fn(async (query) => ({
        items: [
          {
            ...ROW,
            status: 'EXECUTED' as const,
            positionStatus: 'OPEN' as const,
          },
        ],
        page: query.page,
        pageSize: 20,
        total: 45,
      })),
    });
    await open('/plans?tab=EXECUTED', service);
    expect(
      await screen.findByRole('columnheader', { name: 'Position' }),
    ).toBeTruthy();
    expect(screen.getByRole('cell', { name: 'Open' })).toBeTruthy();
    expect(screen.getByText('Page 1 of 3')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(lastList(service)?.page).toBe(2));
    expect(await screen.findByText('Page 2 of 3')).toBeTruthy();
  });
});

describe('SCR-18 plan detail (T-041)', () => {
  it('leaves the Futures-only rows out of a Spot snapshot', async () => {
    const spot: TradingPlan = {
      ...PLAN,
      market: 'spot',
      leverage: null,
      marginMode: null,
      snapshot: {
        ...PLAN.snapshot,
        initialMargin: null,
        maintenanceMarginRateUsed: null,
        estimatedLiquidationPrice: null,
      },
    };
    await open(
      '/plans/' + PLAN.id,
      fakePlans({ get: vi.fn(async () => spot) }),
    );
    const snapshot = within(
      await screen.findByRole('region', { name: 'Calculation snapshot' }),
    );
    expect(snapshot.getByText('Risk (USDT)')).toBeTruthy();
    expect(snapshot.queryByText('Initial margin (USDT)')).toBeNull();
    expect(snapshot.queryByText('Est. liquidation price')).toBeNull();
  });

  it('shows inputs, snapshot, warnings by severity and the status history', async () => {
    priceLines.length = 0;
    await open('/plans/' + PLAN.id);
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'BTC/USDT Plan 0000a1b2',
      }),
    ).toBeTruthy();
    // The chart of the plan's market carries its lines (FEQ-01 gives the pair).
    await waitFor(() =>
      expect(priceLines).toEqual(
        expect.arrayContaining([
          'Entry 62000',
          'Stop loss 63000',
          'Take profit 59000',
          'Liquidation (est.) 74103.1',
        ]),
      ),
    );
    const inputs = within(screen.getByRole('region', { name: 'Plan inputs' }));
    expect(inputs.getByText('Stop loss').nextSibling?.textContent).toBe(
      '63,000.00',
    );
    expect(inputs.getByText('Leverage').nextSibling?.textContent).toBe('5x');
    expect(inputs.getByText('Retest of the range high.')).toBeTruthy();
    const snapshot = within(
      screen.getByRole('region', { name: 'Calculation snapshot' }),
    );
    expect(
      snapshot.getByText('Initial margin (USDT)').nextSibling?.textContent,
    ).toBe('124.00');
    expect(
      snapshot.getByText('Maintenance margin rate').nextSibling?.textContent,
    ).toBe('0.40%');
    expect(
      snapshot.getByText('Est. liquidation price').nextSibling?.textContent,
    ).toBe('74,103.10');
    expect(snapshot.getByText('Position size').nextSibling?.textContent).toBe(
      '0.01',
    );
    const warnings = within(screen.getByRole('region', { name: 'Warnings' }));
    expect(
      warnings.getByText('Warning: Leverage above your risk profile'),
    ).toBeTruthy();
    expect(warnings.getByText('Info: Wide stop loss')).toBeTruthy();
    expect(
      within(screen.getByRole('region', { name: 'Status history' })).getByText(
        'Draft',
      ),
    ).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'Edit' }).getAttribute('href'),
    ).toBe(`/plans/${PLAN.id}/edit`);
  });

  it('shows the validity of a STOP plan, its setup score and why it became INVALIDATED (D-111)', async () => {
    priceLines.length = 0;
    const invalidated: TradingPlan = {
      ...PLAN,
      entryType: 'STOP',
      invalidationPrice: '60500.000000000000',
      maxEntryDeviationR: '0.500000000000',
      analysisTimeframe: '4h',
      status: 'INVALIDATED',
      invalidationReason: 'INVALIDATION_PRICE',
      setupScoreAtPlan: '59.00',
      setupScorePreset: 'DAY_TRADING v1',
      editable: false,
      statusHistory: [
        { status: 'DRAFT', at: '2026-10-08T02:20:00Z' },
        { status: 'ACTIVE', at: '2026-10-08T02:30:00Z' },
        { status: 'INVALIDATED', at: '2026-10-09T09:00:00Z' },
      ],
    };
    await open(
      '/plans/' + PLAN.id,
      fakePlans({ get: vi.fn(async () => invalidated) }),
    );
    const inputs = within(
      await screen.findByRole('region', { name: 'Plan inputs' }),
    );
    expect(inputs.getByText('Entry type').nextSibling?.textContent).toBe(
      'Stop',
    );
    expect(inputs.getByText('Stop price').nextSibling?.textContent).toBe(
      '62,000.00',
    );
    expect(
      inputs.getByText('Invalidation price').nextSibling?.textContent,
    ).toBe('60,500.00');
    expect(
      inputs.getByText('Max entry deviation').nextSibling?.textContent,
    ).toBe('0.5 R');
    expect(
      inputs.getByText('Analysis timeframe').nextSibling?.textContent,
    ).toBe('4h');
    expect(
      inputs.getByText('Setup score at activation').nextSibling?.textContent,
    ).toBe('59.00 (DAY_TRADING v1)');
    const history = within(
      screen.getByRole('region', { name: 'Status history' }),
    );
    expect(history.getByText('Invalidated')).toBeTruthy();
    expect(
      history.getByText('Invalidation price reached before the entry'),
    ).toBeTruthy();
    await waitFor(() =>
      expect(priceLines).toEqual(
        expect.arrayContaining(['Entry 62000', 'Invalidation price 60500']),
      ),
    );
  });

  it('shows an open position: fill, unrealized P/L, current levels and breakeven (T-048a, D-124)', async () => {
    priceLines.length = 0;
    const executed: TradingPlan = {
      ...PLAN,
      status: 'EXECUTED',
      editable: false,
      position: {
        status: 'OPEN',
        fillPrice: '62010.000000000000',
        quantity: '0.010000000000',
        entryTime: '2026-10-08T03:00:00Z',
        entryFee: '0.31000000',
        liquidationPrice: '74100.000000000000',
        currentPrice: '61500.00',
        unrealizedPnl: '5.10000000',
        exitPrice: null,
        exitTime: null,
        closeReason: null,
        realizedPnl: null,
        feeAmount: null,
        fundingFeeAmount: null,
        netPnl: null,
        provisional: false,
        stopLoss: '62800.000000000000',
        takeProfit: '59000.000000000000',
        originalStopLoss: '63000.000000000000',
        originalTakeProfit: '59000.000000000000',
        stopWidened: false,
        levelChangeCount: 1,
        levelChanges: [
          {
            changedAt: '2026-10-08T05:00:00Z',
            oldStopLoss: '63000.000000000000',
            oldTakeProfit: '59000.000000000000',
            newStopLoss: '62800.000000000000',
            newTakeProfit: '59000.000000000000',
          },
        ],
        breakevenPrice: '61940.00',
        breakevenProvisional: true,
        levelWarnings: [],
        levelsEffectiveFrom: '2026-10-08T05:01:00Z',
      },
    };
    await open(
      '/plans/' + PLAN.id,
      fakePlans({ get: vi.fn(async () => executed) }),
    );
    const position = within(
      await screen.findByRole('region', { name: 'Position' }),
    );
    expect(position.getByText('Open')).toBeTruthy();
    expect(
      position.getByText('Unrealized P/L (USDT)').nextSibling?.textContent,
    ).toBe('+5.10');
    expect(position.getByText('Mark price').nextSibling?.textContent).toBe(
      '61,500.00',
    );
    expect(
      position.getAllByText('Stop loss')[0]?.nextSibling?.textContent,
    ).toBe('62,800.00');
    expect(position.getByText('Breakeven stop').nextSibling?.textContent).toBe(
      '61,940.00provisional',
    );
    expect(position.getByText('Level changes')).toBeTruthy();
    expect(position.getByText('63,000.00 → 62,800.00')).toBeTruthy();
    await waitFor(() =>
      expect(priceLines).toEqual(
        expect.arrayContaining(['Entry 62010', 'Stop loss 62800']),
      ),
    );
  });

  it('headlines the net P/L of a closed position, provisional while funding is missing (T-048b)', async () => {
    const closed: TradingPlan = {
      ...PLAN,
      status: 'EXECUTED',
      editable: false,
      position: {
        status: 'CLOSED',
        fillPrice: '62010.000000000000',
        quantity: '0.010000000000',
        entryTime: '2026-10-08T03:00:00Z',
        entryFee: '0.31000000',
        liquidationPrice: '74100.000000000000',
        currentPrice: null,
        unrealizedPnl: null,
        exitPrice: '63080.000000000000',
        exitTime: '2026-10-09T03:00:00Z',
        closeReason: 'STOP_LOSS',
        realizedPnl: '-10.70000000',
        feeAmount: '0.62540000',
        fundingFeeAmount: '-0.04000000',
        netPnl: '-11.36540000',
        provisional: true,
        stopLoss: '63000.000000000000',
        takeProfit: '59000.000000000000',
        originalStopLoss: '63000.000000000000',
        originalTakeProfit: '59000.000000000000',
        stopWidened: false,
        levelChangeCount: 0,
        levelChanges: [],
        breakevenPrice: null,
        breakevenProvisional: false,
        levelWarnings: [],
        levelsEffectiveFrom: null,
      },
    };
    await open(
      '/plans/' + PLAN.id,
      fakePlans({ get: vi.fn(async () => closed) }),
    );
    const position = within(
      await screen.findByRole('region', { name: 'Position' }),
    );
    expect(
      position.getByText('Closed', { selector: 'span *, span' }),
    ).toBeTruthy();
    expect(position.getByText('-11.37')).toBeTruthy();
    expect(position.getByText('Closed by').nextSibling?.textContent).toBe(
      'Stop loss',
    );
    expect(position.getByText('Funding (USDT)').nextSibling?.textContent).toBe(
      '-0.04',
    );
    expect(position.getAllByText('provisional').length).toBeGreaterThan(0);
  });

  it('shows a dash for a setup score that could not be read, and none on a draft', async () => {
    const active: TradingPlan = {
      ...PLAN,
      status: 'ACTIVE',
      editable: false,
      setupScoreAtPlan: null,
      setupScorePreset: null,
    };
    await open(
      '/plans/' + PLAN.id,
      fakePlans({ get: vi.fn(async () => active) }),
    );
    const inputs = within(
      await screen.findByRole('region', { name: 'Plan inputs' }),
    );
    expect(
      inputs.getByText('Setup score at activation').nextSibling?.textContent,
    ).toBe('—');
  });

  it('shows the real loss, R:R after fees, the costs and the fee share (D-116)', async () => {
    const costly: TradingPlan = {
      ...PLAN,
      entryType: 'MARKET',
      entryPrice: '62000.000000000000',
      expectedFillPrice: '62003.100000000000',
      snapshot: {
        ...PLAN.snapshot,
        estimatedEntryFee: '3.10015500',
        estimatedStopLossExitFee: '3.09500000',
        estimatedTakeProfitExitFee: '1.24600000',
        estimatedSlippage: '0.30950000',
        lossAtStopLoss: '16.50465500',
        feeShareOfRisk: '0.65046550',
        netRiskReward: '1.51213436',
      },
      warnings: [{ type: 'HIGH_FEE_SHARE', severity: 'WARNING' }],
    };
    await open(
      '/plans/' + PLAN.id,
      fakePlans({ get: vi.fn(async () => costly) }),
    );
    const snapshot = within(
      await screen.findByRole('region', { name: 'Calculation snapshot' }),
    );
    const value = (label: string) =>
      snapshot.getByText(label).nextSibling?.textContent;
    expect(value('Real loss at stop loss (USDT)')).toBe('16.50');
    expect(value('Reward / risk after fees')).toBe('1.51');
    expect(value('Entry fee (USDT)')).toBe('3.10');
    expect(value('Exit fee at stop loss (USDT)')).toBe('3.10');
    expect(value('Exit fee at take profit (USDT)')).toBe('1.25');
    expect(value('Slippage (USDT)')).toBe('0.31');
    expect(value('Share of the risk')).toBe('65.05%');
    expect(snapshot.getByText(/Funding and the liquidation fee/)).toBeTruthy();
    const inputs = within(screen.getByRole('region', { name: 'Plan inputs' }));
    expect(inputs.getByText('Expected fill').nextSibling?.textContent).toBe(
      '62,003.10',
    );
    const warnings = within(screen.getByRole('region', { name: 'Warnings' }));
    expect(
      warnings.getByText('Fees and slippage are 65.05% of the risk'),
    ).toBeTruthy();
  });

  it('shows a dash for the costs of a plan saved before them', async () => {
    await open('/plans/' + PLAN.id);
    const snapshot = within(
      await screen.findByRole('region', { name: 'Calculation snapshot' }),
    );
    expect(
      snapshot.getByText('Real loss at stop loss (USDT)').nextSibling
        ?.textContent,
    ).toBe('—');
    expect(
      snapshot.getByText('Reward / risk after fees').nextSibling?.textContent,
    ).toBe('—');
    expect(snapshot.queryByText('Fees and slippage (est.)')).toBeNull();
    expect(screen.queryByText('Expected fill')).toBeNull();
  });

  it('activates a draft with MSG19 and shows the new status', async () => {
    const service = await open('/plans/' + PLAN.id);
    await userEvent.click(
      await screen.findByRole('button', { name: 'Activate' }),
    );
    expect(await screen.findByText('Trading plan activated.')).toBeTruthy();
    expect(service.activate).toHaveBeenCalledWith(PLAN.id);
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Activate' })).toBeNull(),
    );
    expect(screen.queryByRole('link', { name: 'Edit' })).toBeNull();
    expect(
      within(screen.getByRole('region', { name: 'Status history' })).getByText(
        'Active',
      ),
    ).toBeTruthy();
  });

  it('shows MSG27 with the plans link, and MSG18 for a blocking warning', async () => {
    const service = fakePlans({
      activate: vi
        .fn()
        .mockRejectedValueOnce(
          refusal(409, 'PLAN_LIMIT_REACHED', 'MSG27', [
            '3',
            'active plans and open positions',
            'FREE',
          ]),
        )
        .mockRejectedValueOnce(
          refusal(409, 'TRADING_BLOCKING_WARNING', 'MSG18'),
        ),
    });
    await open('/plans/' + PLAN.id, service);
    await userEvent.click(
      await screen.findByRole('button', { name: 'Activate' }),
    );
    const limit = await screen.findByRole('alert');
    expect(limit.textContent).toContain(
      'You have reached the limit of 3 active plans and open positions of the FREE plan.',
    );
    expect(
      within(limit).getByRole('link', { name: 'View plans' }),
    ).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Activate' }));
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain(
        'This plan has blocking warnings and cannot be activated.',
      ),
    );
  });

  it('cancels only after the MSG20 confirmation', async () => {
    const service = await open('/plans/' + PLAN.id);
    await userEvent.click(
      await screen.findByRole('button', { name: 'Cancel plan' }),
    );
    const dialog = within(screen.getByRole('dialog'));
    expect(
      dialog.getByText(
        'Cancel this trading plan? This action cannot be undone.',
      ),
    ).toBeTruthy();
    expect(service.cancel).not.toHaveBeenCalled();
    await userEvent.click(dialog.getByRole('button', { name: 'Cancel plan' }));
    await waitFor(() => expect(service.cancel).toHaveBeenCalledWith(PLAN.id));
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Cancel plan' })).toBeNull(),
    );
  });

  it('reads the plan again when it changed elsewhere', async () => {
    const service = fakePlans({
      cancel: vi
        .fn()
        .mockRejectedValue(
          refusal(409, 'TRADING_PLAN_STATUS_TRANSITION_INVALID', 'MSG43'),
        ),
    });
    await open('/plans/' + PLAN.id, service);
    await userEvent.click(
      await screen.findByRole('button', { name: 'Cancel plan' }),
    );
    const reads = vi.mocked(service.get).mock.calls.length;
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Cancel plan',
      }),
    );
    await waitFor(() =>
      expect(vi.mocked(service.get).mock.calls.length).toBeGreaterThan(reads),
    );
  });

  it('says the plan was not found on a 404', async () => {
    await open(
      '/plans/unknown',
      fakePlans({
        get: vi.fn(async () => {
          throw refusal(404, 'RESOURCE_NOT_FOUND', 'MSG41');
        }),
      }),
    );
    expect(
      await screen.findByText(
        'This plan was not found. It may belong to another account.',
      ),
    ).toBeTruthy();
  });
});

const SPOT_DRAFT: TradingPlan = {
  ...PLAN,
  market: 'spot',
  direction: 'LONG',
  entryPrice: '62000.000000000000',
  stopLoss: '60000.000000000000',
  takeProfit: '66000.000000000000',
  leverage: null,
  marginMode: null,
  warnings: [],
  snapshot: {
    ...PLAN.snapshot,
    initialMargin: null,
    maintenanceMarginRateUsed: null,
    estimatedLiquidationPrice: null,
  },
};

describe('SCR-17 new plan (T-040, UC-16)', () => {
  const fill = async (entry: string, stop: string, take: string) => {
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('Entry price'), entry);
    await user.type(screen.getByLabelText('Stop loss'), stop);
    await user.type(screen.getByLabelText('Take profit'), take);
    return user;
  };

  it('starts on the analysis pair, calculates it and saves a draft', async () => {
    priceLines.length = 0;
    const service = fakePlans({
      create: vi.fn(async () => ({ ...PLAN, id: 'new-plan' })),
      get: vi.fn(async () => ({ ...PLAN, id: 'new-plan' })),
    });
    await open('/plans/new?symbol=ETHUSDT', service);
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'New trading plan',
      }),
    ).toBeTruthy();
    const pair = screen.getByLabelText('Pair') as HTMLSelectElement;
    expect(pair.value).toBe('eth-id');
    expect(
      screen.getByRole('radio', { name: 'Spot' }).getAttribute('aria-checked'),
    ).toBe('true');
    const user = await fill('2500', '2400', '2800');
    await waitFor(() =>
      expect(service.calculate).toHaveBeenCalledWith(
        'eth-id',
        expect.objectContaining({ entryPrice: '2500', market: 'spot' }),
        expect.anything(),
      ),
    );
    // The chart of the pair shows the prices as typed.
    await waitFor(() =>
      expect(priceLines).toEqual(
        expect.arrayContaining([
          'Entry 2500',
          'Stop loss 2400',
          'Take profit 2800',
        ]),
      ),
    );
    await user.click(screen.getByRole('button', { name: 'Save as draft' }));
    await waitFor(() =>
      expect(service.create).toHaveBeenCalledWith(
        'eth-id',
        expect.objectContaining({
          entryPrice: '2500',
          stopLoss: '2400',
          takeProfit: '2800',
        }),
        false,
      ),
    );
    expect(await screen.findByText('Saved successfully.')).toBeTruthy();
    // The new plan's detail page is read next.
    await waitFor(() =>
      expect(service.get).toHaveBeenCalledWith('new-plan', expect.anything()),
    );
  });

  it('keeps Futures for PRO and PREMIUM: on FREE it says MSG29 and stays on Spot', async () => {
    const service = fakePlans();
    await open('/plans/new?symbol=BTCUSDT&market=futures', service);
    const futures = await screen.findByRole('radio', { name: 'Futures' });
    // FREE cannot start on Futures, even when asked to.
    expect(
      screen.getByRole('radio', { name: 'Spot' }).getAttribute('aria-checked'),
    ).toBe('true');
    const user = userEvent.setup();
    await user.click(futures);
    expect(
      screen.getByText(
        'This feature is available on the PRO plan or higher. View plans?',
      ),
    ).toBeTruthy();
    expect(futures.getAttribute('aria-checked')).toBe('false');
    expect(screen.queryByLabelText('Leverage')).toBeNull();
  });

  it('shows MSG29 with the plans when the server refuses a Futures plan (FEQ-02)', async () => {
    // The plan is not known up front, so the server refuses on FREE.
    const service = fakePlans({
      calculate: vi.fn(async () => {
        throw refusal(403, 'PLAN_FEATURE_NOT_INCLUDED', 'MSG29', ['PRO']);
      }),
    });
    await open('/plans/new?symbol=BTCUSDT&market=futures', service, 'PRO');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('radio', { name: 'Short' }));
    await user.type(screen.getByLabelText('Entry price'), '62000');
    await user.type(screen.getByLabelText('Stop loss'), '63000');
    await user.type(screen.getByLabelText('Take profit'), '59000');
    expect(
      await screen.findByText(
        'This feature is available on the PRO plan or higher. View plans?',
      ),
    ).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'View plans' }).getAttribute('href'),
    ).toBe('/subscription');
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
  });

  it('starts a Futures plan from the analysis at 1x and saves it with its side (BR-26)', async () => {
    const service = fakePlans({
      create: vi.fn(async () => ({ ...PLAN, id: 'new-plan' })),
      get: vi.fn(async () => ({ ...PLAN, id: 'new-plan' })),
    });
    await open('/plans/new?symbol=BTCUSDT&market=futures', service, 'PRO');
    const futures = await screen.findByRole('radio', { name: 'Futures' });
    expect(futures.getAttribute('aria-checked')).toBe('true');
    expect((screen.getByLabelText('Pair') as HTMLSelectElement).value).toBe(
      ROW.pairId,
    );
    expect((screen.getByLabelText('Leverage') as HTMLInputElement).value).toBe(
      '1',
    );
    expect(screen.getByText('Margin mode').nextSibling?.textContent).toBe(
      'Isolated',
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('radio', { name: 'Short' }));
    await user.type(screen.getByLabelText('Entry price'), '62000');
    await user.type(screen.getByLabelText('Stop loss'), '63000');
    await user.type(screen.getByLabelText('Take profit'), '59000');
    await waitFor(() =>
      expect(service.calculate).toHaveBeenCalledWith(
        ROW.pairId,
        expect.objectContaining({
          market: 'futures',
          direction: 'SHORT',
          leverage: 1,
        }),
        expect.anything(),
      ),
    );
    await user.click(screen.getByRole('button', { name: 'Save as draft' }));
    await waitFor(() =>
      expect(service.create).toHaveBeenCalledWith(
        ROW.pairId,
        expect.objectContaining({ market: 'futures', direction: 'SHORT' }),
        false,
      ),
    );
  });

  it('shows the mark price, funding and its countdown beside a Futures plan (BR-11)', async () => {
    const market = fakeMarket();
    vi.mocked(market.getTicker).mockImplementation(async (kind) =>
      kind === 'futures'
        ? {
            market: 'futures',
            symbol: 'BTCUSDT',
            sourceTime: new Date().toISOString(),
            lastPrice: '62010.30',
            bestBid: null,
            bestAsk: null,
            high24h: null,
            low24h: null,
            changePercent24h: null,
            baseVolume24h: null,
            quoteVolume24h: null,
            markPrice: '62004.10',
            indexPrice: '62000.00',
            fundingRate: '-0.0001',
            nextFundingTime: new Date(Date.now() + 3_600_000).toISOString(),
          }
        : null,
    );
    await open(
      '/plans/new?symbol=BTCUSDT&market=futures',
      fakePlans(),
      'PRO',
      market,
    );
    const strip = within(
      await screen.findByLabelText('Futures prices and funding'),
    );
    const value = (label: string) =>
      strip.getByText(label).nextSibling?.textContent;
    // At the Futures pair's tick, 0.10; no last price on Futures (M-09).
    await waitFor(() => expect(value('Mark price')).toBe('62,004.1'));
    expect(strip.queryByText('Last price')).toBeNull();
    expect(value('Funding rate')).toBe('-0.0100%');
    expect(value('Next funding in')).toMatch(/^(00:59:\d\d|01:00:00)$/);
  });

  it('moves between markets on the same coin, back to a long on Spot', async () => {
    await open('/plans/new?symbol=ETHUSDT', fakePlans(), 'PRO');
    const pair = (await screen.findByLabelText('Pair')) as HTMLSelectElement;
    expect(pair.value).toBe('eth-id');
    const user = userEvent.setup();
    // ETH is Spot only: Futures starts on its first pair, BTC.
    await user.click(screen.getByRole('radio', { name: 'Futures' }));
    expect(pair.value).toBe(ROW.pairId);
    expect(within(pair).queryByRole('option', { name: 'ETH/USDT' })).toBeNull();
    await user.click(screen.getByRole('radio', { name: 'Short' }));
    await user.click(screen.getByRole('radio', { name: 'Spot' }));
    expect(pair.value).toBe(ROW.pairId);
    expect(screen.queryByRole('radio', { name: 'Short' })).toBeNull();
    expect(screen.getByText('Spot plans are long only.')).toBeTruthy();
  });

  it('words a leverage the server refused as above the bracket (BR-26)', async () => {
    const service = fakePlans({
      calculate: vi.fn(async () => {
        throw new ServiceError('refused', 'HTTP_ERROR', 400, {
          status: 400,
          code: 'VALIDATION_FAILED',
          messageCode: 'MSG01',
          messageArgs: [],
          fieldErrors: { leverage: 'MSG15' },
        });
      }),
    });
    await open('/plans/new?symbol=BTCUSDT&market=futures', service, 'PRO');
    const user = userEvent.setup();
    const leverage = await screen.findByLabelText('Leverage');
    await user.clear(leverage);
    await user.type(leverage, '125');
    await user.type(screen.getByLabelText('Entry price'), '62000');
    await user.type(screen.getByLabelText('Stop loss'), '61000');
    await user.type(screen.getByLabelText('Take profit'), '65000');
    expect(
      await screen.findByText(
        'Leverage is above the maximum for this position size, or the pair has no leverage brackets yet.',
      ),
    ).toBeTruthy();
  });

  it('saves nothing when the server refuses the activation (MSG18)', async () => {
    const service = fakePlans({
      create: vi.fn(async () => {
        throw new ServiceError('refused', 'HTTP_ERROR', 409, {
          status: 409,
          code: 'TRADING_BLOCKING_WARNING',
          messageCode: 'MSG18',
          messageArgs: [],
          fieldErrors: {},
        });
      }),
    });
    await open('/plans/new', service);
    const user = await fill('62000', '61000', '65000');
    await user.click(
      await screen.findByRole('button', { name: 'Save and activate' }),
    );
    await waitFor(() =>
      expect(service.create).toHaveBeenCalledWith(
        ROW.pairId,
        expect.anything(),
        true,
      ),
    );
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'New trading plan',
      }),
    ).toBeTruthy();
  });

  it('checks the price order before sending anything (BR-22)', async () => {
    const service = fakePlans();
    await open('/plans/new', service);
    const user = await fill('62000', '63000', '65000');
    await user.click(screen.getByRole('button', { name: 'Save as draft' }));
    expect(service.create).not.toHaveBeenCalled();
    expect(
      (await screen.findAllByText(/For long positions/)).length,
    ).toBeTruthy();
  });

  const scalper = (): ProfileService =>
    ({
      get: vi.fn(async () => ({ ...devProfile, tradingStyle: 'SCALPING' })),
      getRiskProfile: vi.fn(async () => devRiskParams.CONSERVATIVE),
    }) as unknown as ProfileService;

  it('sends a LIMIT entry with its invalidation price, deviation limit and the style timeframe (D-111, D-112)', async () => {
    priceLines.length = 0;
    const service = fakePlans({
      create: vi.fn(async () => ({ ...PLAN, id: 'new-plan' })),
      get: vi.fn(async () => ({ ...PLAN, id: 'new-plan' })),
    });
    await open('/plans/new', service, 'FREE', fakeMarket(), scalper());
    const timeframe = (await screen.findByLabelText(
      'Analysis timeframe',
    )) as HTMLSelectElement;
    // SCALPING plans on 15m unless the Trader picks another one.
    expect(timeframe.value).toBe('15m');
    const user = userEvent.setup();
    // The engine triggers STOP entries (TP-B): a new plan offers them.
    expect(screen.getByRole('radio', { name: 'Stop' })).toBeTruthy();
    await user.type(screen.getByLabelText('Entry price'), '62000');
    await user.type(screen.getByLabelText('Stop loss'), '60000');
    await user.type(screen.getByLabelText('Take profit'), '66000');
    await user.type(
      screen.getByLabelText('Invalidation price (optional)'),
      '64000',
    );
    await user.type(
      screen.getByLabelText('Max entry deviation (R, optional)'),
      '0.5',
    );
    await user.selectOptions(timeframe, '1h');
    await waitFor(() =>
      expect(priceLines).toEqual(
        expect.arrayContaining(['Entry 62000', 'Invalidation price 64000']),
      ),
    );
    await user.click(screen.getByRole('button', { name: 'Save as draft' }));
    await waitFor(() =>
      expect(service.create).toHaveBeenCalledWith(
        ROW.pairId,
        expect.objectContaining({
          entryType: 'LIMIT',
          entryPrice: '62000',
          invalidationPrice: '64000',
          maxEntryDeviationR: '0.5',
          analysisTimeframe: '1h',
        }),
        false,
      ),
    );
  });

  it('leaves the timeframe to the server when the profile cannot be read, and has no invalidation on a market entry', async () => {
    const service = fakePlans();
    const unreadable = {
      get: vi.fn(async () => {
        throw new ServiceError('offline', 'NETWORK_ERROR');
      }),
      getRiskProfile: vi.fn(async () => devRiskParams.CONSERVATIVE),
    } as unknown as ProfileService;
    await open('/plans/new', service, 'FREE', fakeMarket(), unreadable);
    const timeframe = (await screen.findByLabelText(
      'Analysis timeframe',
    )) as HTMLSelectElement;
    expect(timeframe.value).toBe('');
    expect(
      within(timeframe).getByRole('option', {
        name: 'Your trading style’s default',
      }),
    ).toBeTruthy();
    const user = userEvent.setup();
    await user.click(screen.getByRole('radio', { name: 'Market' }));
    expect(screen.queryByLabelText('Invalidation price (optional)')).toBeNull();
    expect(
      screen.getByText('A market entry has no invalidation price.'),
    ).toBeTruthy();
  });

  it('says why the server refused the invalidation price (MSG16, D-112)', async () => {
    const service = fakePlans({
      create: vi.fn().mockRejectedValueOnce(fieldRefusal('invalidationPrice')),
    });
    await open('/plans/new', service, 'FREE', fakeMarket(), scalper());
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('Entry price'), '62000');
    await user.type(screen.getByLabelText('Stop loss'), '60000');
    await user.type(screen.getByLabelText('Take profit'), '66000');
    await user.type(
      screen.getByLabelText('Invalidation price (optional)'),
      '61000',
    );
    await user.click(screen.getByRole('button', { name: 'Save as draft' }));
    expect(
      await screen.findByText(
        'For long positions: the invalidation price must lie beyond the current price, on the far side from the entry.',
      ),
    ).toBeTruthy();
  });
});

describe('SCR-17 edit a draft plan (T-040)', () => {
  const editPath = '/plans/' + SPOT_DRAFT.id + '/edit';
  const calculation = (overrides: Partial<TradingPlan['snapshot']> = {}) => ({
    entryPrice: '62000.00',
    expectedFillPrice: null,
    capital: '1000',
    riskPercent: '1',
    snapshot: { ...SPOT_DRAFT.snapshot, ...overrides },
    warnings: [],
    blocksActivation: false,
  });

  it('prefills the draft and recalculates on the server as the Trader types', async () => {
    const service = fakePlans({
      get: vi.fn(async () => SPOT_DRAFT),
      calculate: vi.fn(async (_pair, inputs) =>
        calculation({
          riskAmount:
            inputs.stopLoss === '61000' ? '20.00000000' : '10.00000000',
        }),
      ),
    });
    await open(editPath, service);
    const stop = (await screen.findByLabelText(
      'Stop loss',
    )) as HTMLInputElement;
    expect(stop.value).toBe('60000');
    const panel = within(
      screen.getByRole('region', { name: 'Risk calculation' }),
    );
    expect(
      (await panel.findByText('Risk (USDT)')).nextSibling?.textContent,
    ).toBe('10.00');
    // The capital is the account's, never typed (D-121).
    expect(screen.queryByRole('textbox', { name: /Capital/ })).toBe(null);
    expect(
      screen.getByRole('link', { name: 'Change in Profile & Settings' }),
    ).toBeTruthy();
    const user = userEvent.setup();
    await user.clear(stop);
    await user.type(stop, '61000');
    await waitFor(() =>
      expect(panel.getByText('Risk (USDT)').nextSibling?.textContent).toBe(
        '20.00',
      ),
    );
    expect(vi.mocked(service.calculate).mock.calls.at(-1)?.[0]).toBe(
      SPOT_DRAFT.pairId,
    );
    expect(vi.mocked(service.calculate).mock.calls.at(-1)?.[1]).toMatchObject({
      market: 'spot',
      direction: 'LONG',
      stopLoss: '61000',
      leverage: null,
    });
    expect(
      vi.mocked(service.calculate).mock.calls.at(-1)?.[1],
    ).not.toHaveProperty('capital');
  });

  it('asks for a default capital in Profile & Settings when the profile has none (D-121)', async () => {
    const noCapital = {
      get: vi.fn(async () => ({ ...devProfile, defaultCapital: null })),
      getRiskProfile: vi.fn(async () => devRiskParams.CONSERVATIVE),
    } as unknown as ProfileService;
    const service = fakePlans({
      get: vi.fn(async () => SPOT_DRAFT),
      calculate: vi.fn().mockRejectedValue(
        new ServiceError('refused', 'HTTP_ERROR', 400, {
          status: 400,
          code: 'VALIDATION_FAILED',
          messageCode: 'MSG01',
          messageArgs: [],
          fieldErrors: { capital: 'MSG01' },
        }),
      ),
    });
    await open(editPath, service, 'FREE', fakeMarket(), noCapital);
    expect(
      await screen.findByText(
        'Set a default capital in Profile & Settings first: every plan is sized on it.',
      ),
    ).toBeTruthy();
    expect(
      screen
        .getByRole('link', { name: 'Set it in Profile & Settings' })
        .getAttribute('href'),
    ).toBe('/profile');
  });

  it('shows the expected fill of a market entry only when slippage moves it (D-112)', async () => {
    const market = { ...SPOT_DRAFT, entryType: 'MARKET' as const };
    const service = fakePlans({
      get: vi.fn(async () => market),
      calculate: vi.fn(async () => ({
        ...calculation(),
        expectedFillPrice: '62003.10',
      })),
    });
    await open(editPath, service);
    expect(
      (await screen.findByText('Expected fill')).nextSibling?.textContent,
    ).toBe('62,003.10');
  });

  it('hides the expected fill when it equals the current price', async () => {
    const market = { ...SPOT_DRAFT, entryType: 'MARKET' as const };
    const service = fakePlans({
      get: vi.fn(async () => market),
      calculate: vi.fn(async () => ({
        ...calculation(),
        expectedFillPrice: '62000.000',
      })),
    });
    await open(editPath, service);
    const panel = within(
      await screen.findByRole('region', { name: 'Risk calculation' }),
    );
    await panel.findByText('Risk (USDT)');
    expect(screen.getByText('Current last price')).toBeTruthy();
    expect(screen.queryByText('Expected fill')).toBeNull();
  });

  it('keeps the STOP of a saved STOP draft and says why a reached stop was refused (MSG16)', async () => {
    const stopDraft: TradingPlan = {
      ...SPOT_DRAFT,
      entryType: 'STOP',
      entryPrice: '70000.000000000000',
      plannedEntryPrice: '70000.000000000000',
      stopLoss: '68000.000000000000',
      takeProfit: '76000.000000000000',
    };
    const service = fakePlans({
      get: vi.fn(async () => stopDraft),
      update: vi.fn().mockRejectedValueOnce(fieldRefusal('entryPrice')),
    });
    await open(editPath, service);
    const stop = await screen.findByRole('radio', { name: 'Stop' });
    expect(stop.getAttribute('aria-checked')).toBe('true');
    expect(screen.getByText(/Enters at market once the price reaches/));
    expect(
      (screen.getByLabelText('Stop price') as HTMLInputElement).value,
    ).toBe('70000');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Save and activate' }));
    expect(
      await screen.findByText(
        'For long positions: a stop entry must be above the current price; it has been reached, so use a market entry.',
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(/or worse when the price gaps past it/),
    ).toBeTruthy();
  });

  it('edits a Futures draft with its direction, leverage and the fixed isolated margin (BR-26)', async () => {
    await open('/plans/' + PLAN.id + '/edit', fakePlans(), 'PRO');
    const short = await screen.findByRole('radio', { name: 'Short' });
    expect(short.getAttribute('aria-checked')).toBe('true');
    expect((screen.getByLabelText('Leverage') as HTMLInputElement).value).toBe(
      '5',
    );
    expect(screen.getByText('Margin mode').nextSibling?.textContent).toBe(
      'Isolated',
    );
  });

  it('shows MSG16 under the stop loss and sends nothing while the order is wrong', async () => {
    const service = fakePlans({ get: vi.fn(async () => SPOT_DRAFT) });
    await open(editPath, service);
    const stop = await screen.findByLabelText('Stop loss');
    await waitFor(() => expect(service.calculate).toHaveBeenCalled());
    vi.mocked(service.calculate).mockClear();
    const user = userEvent.setup();
    await user.clear(stop);
    await user.type(stop, '63000');
    expect(
      await screen.findByText(
        'For long positions: stop loss < entry price < take profit.',
      ),
    ).toBeTruthy();
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(service.calculate).not.toHaveBeenCalled();
  });

  it('saves as draft with MSG14 and returns to the plan', async () => {
    const service = fakePlans({
      get: vi.fn(async () => SPOT_DRAFT),
      calculate: vi.fn(async () => calculation()),
    });
    await open(editPath, service);
    // The fixed pair is named from the market lists.
    expect(await screen.findByText('BTC/USDT')).toBeTruthy();
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole('button', { name: 'Save as draft' }),
    );
    expect(await screen.findByText('Saved successfully.')).toBeTruthy();
    expect(service.update).toHaveBeenCalledWith(
      SPOT_DRAFT.id,
      expect.objectContaining({ stopLoss: '60000', entryPrice: '62000' }),
      false,
    );
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'BTC/USDT Plan 0000a1b2',
      }),
    ).toBeTruthy();
  });

  it('refuses activation with MSG27 and the plans link, nothing saved', async () => {
    const service = fakePlans({
      get: vi.fn(async () => SPOT_DRAFT),
      calculate: vi.fn(async () => calculation()),
      update: vi.fn(async () => {
        throw refusal(409, 'PLAN_LIMIT_REACHED', 'MSG27', [
          '3',
          'active plans and open positions',
          'FREE',
        ]);
      }),
    });
    await open(editPath, service);
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole('button', { name: 'Save and activate' }),
    );
    expect(
      await screen.findByText(
        'You have reached the limit of 3 active plans and open positions of the FREE plan. Upgrade to increase the limit?',
      ),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'View plans' })).toBeTruthy();
    expect(vi.mocked(service.update).mock.calls[0]?.[2]).toBe(true);
  });

  it('disables activation while a blocking warning exists (MSG18)', async () => {
    const service = fakePlans({
      get: vi.fn(async () => SPOT_DRAFT),
      calculate: vi.fn(async () => ({
        ...calculation(),
        warnings: [
          {
            type: 'INSUFFICIENT_CAPITAL' as const,
            severity: 'BLOCKING' as const,
          },
        ],
        blocksActivation: true,
      })),
    });
    await open(editPath, service);
    await waitFor(() =>
      expect(
        (
          screen.getByRole('button', {
            name: 'Save and activate',
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(true),
    );
    expect(
      screen.getByText(
        'This plan has blocking warnings and cannot be activated.',
      ),
    ).toBeTruthy();
    expect(
      screen.getByText('Not enough capital for this position'),
    ).toBeTruthy();
  });

  it('shows a server field error under its field', async () => {
    const service = fakePlans({
      get: vi.fn(async () => SPOT_DRAFT),
      calculate: vi.fn(async () => {
        throw new ServiceError('refused', 'HTTP_ERROR', 400, {
          status: 400,
          code: 'VALIDATION_FAILED',
          messageCode: 'MSG01',
          messageArgs: [],
          fieldErrors: { takeProfit: 'MSG16' },
        });
      }),
    });
    await open(editPath, service);
    expect(
      await screen.findByText(
        'For long positions: stop loss < entry price < take profit, with neither level already reached by the current price.',
      ),
    ).toBeTruthy();
    expect(
      screen.getByLabelText('Take profit').getAttribute('aria-invalid'),
    ).toBe('true');
  });

  it('keeps a plan that is not a draft read-only (BR-32)', async () => {
    await open(
      editPath,
      fakePlans({
        get: vi.fn(async () => ({
          ...SPOT_DRAFT,
          status: 'ACTIVE' as const,
          editable: false,
        })),
      }),
    );
    expect(
      await screen.findByText(
        /Only draft plans can be edited\. This plan is active\./,
      ),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Save as draft' })).toBeNull();
  });
});
