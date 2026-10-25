// @vitest-environment jsdom
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlanCreatePage } from '../../pages/trader/PlanCreatePage';
import { PlanDetailPage } from '../../pages/trader/PlanDetailPage';
import { PlanEditPage } from '../../pages/trader/PlanEditPage';
import { PlansPage } from '../../pages/trader/PlansPage';
import type {
  MarketService,
  ProfileService,
  TradingPlanService,
} from '../../services/api/contracts';
import { ServiceError } from '../../services/api/errors';
import type { Services } from '../../services/api/services';
import type {
  MarketPair,
  MarketType,
  PlanEntitlements,
  Session,
  TradingPlan,
  TradingPlanSummary,
  UserProfile,
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
  stopLoss: '63000.000000000000',
  takeProfit: '59000.000000000000',
  expectedFillPrice: null,
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
  stopLoss: '63000.000000000000',
  takeProfit: '59000.000000000000',
  expectedFillPrice: null,
  plannedEntryPrice: '62000.000000000000',
  capital: '1000',
  riskPercent: '1',
  leverage: 5,
  marginMode: 'ISOLATED',
  expiresAt: EXPIRES_AT,
  note: 'Retest of the range high.',
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
    estimatedEntryFee: '0.12400000',
    estimatedStopLossExitFee: '0.31500000',
    estimatedTakeProfitExitFee: '0.11800000',
    estimatedSlippage: '0.00000000',
    lossAtStopLoss: '10.43900000',
    feeShareOfRisk: '0.04390000',
    netRiskReward: '2.80000000',
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

const plan = (tier: 'FREE' | 'PRO'): PlanEntitlements => ({
  tier,
  features: [],
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
  extra: Partial<Omit<Services, 'auth'>> = {},
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
    { tradingPlan: service, market, ...extra },
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

  it('adds the position columns on the Executed tab and pages by 20', async () => {
    const service = fakePlans({
      list: vi.fn(async (query) => ({
        items: [{ ...ROW, status: 'EXECUTED' as const }],
        page: query.page,
        pageSize: 20,
        total: 45,
      })),
    });
    await open('/plans?tab=EXECUTED', service);
    expect(
      await screen.findByRole('columnheader', { name: 'P/L (USDT)' }),
    ).toBeTruthy();
    expect(screen.getByText(/Position status and P\/L appear/)).toBeTruthy();
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
            inputs.riskPercent === '2' ? '20.00000000' : '10.00000000',
        }),
      ),
    });
    await open(editPath, service);
    const risk = await screen.findByLabelText('Risk per trade (%)');
    expect((risk as HTMLInputElement).value).toBe('1');
    expect((screen.getByLabelText('Stop loss') as HTMLInputElement).value).toBe(
      '60000',
    );
    const panel = within(
      screen.getByRole('region', { name: 'Risk calculation' }),
    );
    expect(
      (await panel.findByText('Risk (USDT)')).nextSibling?.textContent,
    ).toBe('10.00');
    const user = userEvent.setup();
    await user.clear(risk);
    await user.type(risk, '2');
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
      riskPercent: '2',
      leverage: null,
    });
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
        'For long positions: stop loss < entry price < take profit.',
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

describe('contract sync: new statuses, entry type and warnings (T-041, T-040)', () => {
  it('lists an INVALIDATED plan in Cancelled / Expired with its reason', async () => {
    const service = fakePlans({
      list: vi.fn(async (query) => ({
        items:
          query.tab === 'CANCELLED_EXPIRED'
            ? (
                [
                  'TAKE_PROFIT_REACHED',
                  'STOP_LOSS_REACHED',
                  'INVALIDATION_PRICE',
                ] as const
              ).map((reason, index) => ({
                ...ROW,
                id: ROW.id.slice(0, -1) + index,
                status: 'INVALIDATED' as const,
                invalidatedAt: '2026-10-09T02:20:00Z',
                invalidationReason: reason,
              }))
            : [],
        page: 1,
        pageSize: 20,
        total: query.tab === 'CANCELLED_EXPIRED' ? 3 : 0,
      })),
    });
    await open('/plans?tab=CANCELLED_EXPIRED', service);
    const table = within(
      await screen.findByRole('region', {
        name: 'Cancelled / Expired trading plans',
      }),
    );
    expect(await table.findAllByText('Invalidated')).toHaveLength(3);
    expect(
      table.getByText('Take profit reached before the entry'),
    ).toBeTruthy();
    expect(table.getByText('Stop loss reached before the entry')).toBeTruthy();
    expect(table.getByText('Invalidation price reached')).toBeTruthy();
  });

  it('shows a STOP entry, HIGH_FEE_SHARE with its share and an unknown warning', async () => {
    await open(
      '/plans/' + PLAN.id,
      fakePlans({
        get: vi.fn(async () => ({
          ...PLAN,
          entryType: 'STOP' as const,
          snapshot: { ...PLAN.snapshot, feeShareOfRisk: '0.23450000' },
          warnings: [
            { type: 'HIGH_FEE_SHARE' as const, severity: 'WARNING' as const },
            {
              type: 'UNKNOWN' as const,
              severity: 'INFO' as const,
              rawType: 'NEW_RULE',
            },
          ],
        })),
      }),
    );
    const inputs = within(
      await screen.findByRole('region', { name: 'Plan inputs' }),
    );
    expect(inputs.getByText('Stop (breakout)')).toBeTruthy();
    const warnings = within(screen.getByRole('region', { name: 'Warnings' }));
    expect(
      warnings.getByText('Fees and slippage are 23.45% of your risk'),
    ).toBeTruthy();
    expect(
      warnings.getByText('Warning: Fees and slippage are 23.45% of your risk', {
        exact: false,
      }),
    ).toBeTruthy();
    expect(warnings.getByText('Unrecognised warning (NEW_RULE)')).toBeTruthy();
  });

  it('shows the reason of an INVALIDATED plan on its detail', async () => {
    await open(
      '/plans/' + PLAN.id,
      fakePlans({
        get: vi.fn(async () => ({
          ...PLAN,
          status: 'INVALIDATED' as const,
          editable: false,
          invalidationReason: 'INVALIDATION_PRICE' as const,
        })),
      }),
    );
    const inputs = within(
      await screen.findByRole('region', { name: 'Plan inputs' }),
    );
    expect(inputs.getByText('Invalidation price reached')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Cancel plan' })).toBeNull();
  });
});

describe('SCR-17 validity, fees and capital (T-040)', () => {
  const profileOf = (
    overrides: Partial<UserProfile> = {},
  ): Partial<Omit<Services, 'auth'>> => ({
    profile: {
      get: vi.fn(async () => ({
        email: 'trader@example.test',
        displayName: 'Trader',
        avatarUrl: null,
        defaultCapital: '2500.00000000',
        defaultRiskPercent: '1',
        tradingStyle: 'SCALPING' as const,
        riskProfile: 'BALANCED' as const,
        notifyEmail: true,
        notifyPush: false,
        ...overrides,
      })),
    } as unknown as ProfileService,
  });
  const lastInputs = (service: TradingPlanService) =>
    vi.mocked(service.calculate).mock.calls.at(-1)?.[1];
  const typePrices = async (
    user: ReturnType<typeof userEvent.setup>,
    entryLabel: string | null,
    entry: string,
    stop: string,
    take: string,
  ) => {
    if (entryLabel)
      await user.type(await screen.findByLabelText(entryLabel), entry);
    await user.type(screen.getByLabelText('Stop loss'), stop);
    await user.type(screen.getByLabelText('Take profit'), take);
  };
  const refusedOn = (field: string, messageCode: string) =>
    vi.fn(async () => {
      throw new ServiceError('refused', 'HTTP_ERROR', 400, {
        status: 400,
        code: 'VALIDATION_FAILED',
        messageCode: 'MSG01',
        messageArgs: [],
        fieldErrors: { [field]: messageCode },
      });
    });

  it('offers STOP with the breakout hint and sends the stop price', async () => {
    const service = fakePlans();
    await open('/plans/new', service);
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole('radio', { name: 'Stop (breakout)' }),
    );
    expect(screen.getByText(/Breakout entry: it triggers/)).toBeTruthy();
    await typePrices(user, 'Stop price', '64000', '63000', '67000');
    await waitFor(() =>
      expect(lastInputs(service)).toMatchObject({
        entryType: 'STOP',
        entryPrice: '64000',
      }),
    );
  });

  it('prices MARKET on the server, hides the invalidation price and shows a moved fill', async () => {
    const service = fakePlans({
      calculate: vi.fn(async () => ({
        entryPrice: '62000.00',
        expectedFillPrice: '62006.20',
        capital: '1000',
        riskPercent: '1',
        snapshot: PLAN.snapshot,
        warnings: [],
        blocksActivation: false,
      })),
    });
    await open('/plans/new', service);
    const user = userEvent.setup();
    expect(
      await screen.findByLabelText('Invalidation price (optional)'),
    ).toBeTruthy();
    await user.click(screen.getByRole('radio', { name: 'Market' }));
    expect(screen.queryByLabelText('Invalidation price (optional)')).toBeNull();
    expect(screen.queryByLabelText('Entry price')).toBeNull();
    await typePrices(user, null, '', '61000', '65000');
    expect(await screen.findByText('Expected fill')).toBeTruthy();
    expect(screen.getByText('62,006.20')).toBeTruthy();
    expect(lastInputs(service)).toMatchObject({
      entryType: 'MARKET',
      entryPrice: null,
      invalidationPrice: null,
    });
  });

  it('shows no expected fill when it equals the entry price', async () => {
    const service = fakePlans({
      calculate: vi.fn(async () => ({
        entryPrice: '62000.00',
        expectedFillPrice: '62000.0000',
        capital: '1000',
        riskPercent: '1',
        snapshot: PLAN.snapshot,
        warnings: [],
        blocksActivation: false,
      })),
    });
    await open('/plans/new', service);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('radio', { name: 'Market' }));
    await typePrices(user, null, '', '61000', '65000');
    expect(
      await within(
        screen.getByRole('region', { name: 'Risk calculation' }),
      ).findByText('Real loss at stop loss (USDT)'),
    ).toBeTruthy();
    expect(screen.queryByText('Expected fill')).toBeNull();
  });

  it('checks the invalidation side before sending it (TP-A)', async () => {
    const service = fakePlans();
    await open('/plans/new', service);
    const user = userEvent.setup();
    await typePrices(user, 'Entry price', '62000', '60000', '66000');
    const invalidation = screen.getByLabelText('Invalidation price (optional)');
    await user.type(invalidation, '61000');
    expect(
      await screen.findByText(
        'For long positions: the invalidation price must be above the current price.',
      ),
    ).toBeTruthy();
    await user.clear(invalidation);
    await user.type(invalidation, '63000');
    await waitFor(() =>
      expect(lastInputs(service)).toMatchObject({ invalidationPrice: '63000' }),
    );
    expect(screen.queryByText(/invalidation price must be/)).toBeNull();
  });

  it('words the server’s MSG16 on the invalidation price from direction and entry type (M-11)', async () => {
    const service = fakePlans({
      calculate: refusedOn('invalidationPrice', 'MSG16'),
    });
    await open('/plans/new', service);
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole('radio', { name: 'Stop (breakout)' }),
    );
    await typePrices(user, 'Stop price', '64000', '63000', '67000');
    await user.type(
      screen.getByLabelText('Invalidation price (optional)'),
      '61000',
    );
    expect(
      await screen.findByText(
        'For long positions: the invalidation price must be below the current price.',
      ),
    ).toBeTruthy();
  });

  it('keeps the entry deviation above 0 and at most 0.75 R (MSG15)', async () => {
    const service = fakePlans();
    await open('/plans/new', service);
    const user = userEvent.setup();
    const deviation = await screen.findByLabelText(
      'Max entry deviation in R (optional)',
    );
    await user.type(deviation, '0.8');
    expect(
      await screen.findByText(
        'Max entry deviation must be between 0 and 0.75.',
      ),
    ).toBeTruthy();
    await user.clear(deviation);
    await user.type(deviation, '0');
    expect(
      await screen.findByText('Max entry deviation must be greater than 0.'),
    ).toBeTruthy();
    await user.clear(deviation);
    await user.type(deviation, '0.75');
    await typePrices(user, 'Entry price', '62000', '60000', '66000');
    await waitFor(() =>
      expect(lastInputs(service)).toMatchObject({ maxEntryDeviationR: '0.75' }),
    );
  });

  it('defaults the analysis timeframe from the trading style and sends a pick', async () => {
    const service = fakePlans();
    await open('/plans/new', service, 'FREE', fakeMarket(), profileOf());
    const timeframe = (await screen.findByLabelText(
      'Analysis timeframe',
    )) as HTMLSelectElement;
    await waitFor(() => expect(timeframe.value).toBe('15m'));
    const user = userEvent.setup();
    await typePrices(user, 'Entry price', '62000', '60000', '66000');
    await waitFor(() =>
      expect(lastInputs(service)).toMatchObject({ analysisTimeframe: '15m' }),
    );
    await user.selectOptions(timeframe, '4h');
    await waitFor(() =>
      expect(lastInputs(service)).toMatchObject({ analysisTimeframe: '4h' }),
    );
  });

  it('shows the profile capital read-only with the link to Profile & Settings (TP-D)', async () => {
    await open('/plans/new', fakePlans(), 'FREE', fakeMarket(), profileOf());
    expect(await screen.findByText('2,500.00')).toBeTruthy();
    expect(screen.queryByRole('textbox', { name: /Capital/ })).toBeNull();
    expect(
      screen
        .getByRole('link', { name: 'Change in Profile & Settings' })
        .getAttribute('href'),
    ).toBe('/profile');
    expect(
      screen.queryByText(/Your profile has no default capital/),
    ).toBeNull();
  });

  it('says the profile has no capital on MSG01 under capital (TP-D)', async () => {
    const service = fakePlans({ calculate: refusedOn('capital', 'MSG01') });
    await open(
      '/plans/new',
      service,
      'FREE',
      fakeMarket(),
      profileOf({ defaultCapital: null }),
    );
    const user = userEvent.setup();
    await typePrices(user, 'Entry price', '62000', '60000', '66000');
    expect(
      await screen.findByText(/Your profile has no default capital/),
    ).toBeTruthy();
  });

  it('shows real loss, R:R after fees, the fee lines, the note and HIGH_FEE_SHARE', async () => {
    const service = fakePlans({
      calculate: vi.fn(async () => ({
        entryPrice: '62000.00',
        expectedFillPrice: null,
        capital: '1000',
        riskPercent: '1',
        snapshot: {
          ...PLAN.snapshot,
          lossAtStopLoss: '12.34000000',
          netRiskReward: '2.38382659',
          feeShareOfRisk: '0.23400000',
        },
        warnings: [
          { type: 'HIGH_FEE_SHARE' as const, severity: 'WARNING' as const },
        ],
        blocksActivation: false,
      })),
    });
    await open('/plans/new', service);
    const user = userEvent.setup();
    await typePrices(user, 'Entry price', '62000', '60000', '66000');
    const panel = within(
      screen.getByRole('region', { name: 'Risk calculation' }),
    );
    const value = async (label: string) =>
      (await panel.findByText(label)).nextSibling?.textContent;
    expect(await value('Real loss at stop loss (USDT)')).toBe('12.34');
    expect(await value('R:R after fees')).toBe('2.38');
    expect(await value('Entry fee (est.)')).toBe('0.12');
    expect(await value('Exit fee at stop loss (est.)')).toBe('0.32');
    expect(await value('Exit fee at take profit (est.)')).toBe('0.12');
    expect(await value('Slippage (est.)')).toBe('0.00');
    expect(await value('Fees and slippage / risk')).toBe('23.40%');
    expect(
      panel.getByText(
        /Funding and the liquidation clearance fee are not included/,
      ),
    ).toBeTruthy();
    const warnings = within(screen.getByRole('region', { name: 'Warnings' }));
    expect(
      warnings.getByText('Fees and slippage are 23.40% of your risk'),
    ).toBeTruthy();
    expect(warnings.getByText('Warning')).toBeTruthy();
  });

  it('shows a dash for the fee figures of a plan saved before TP-0', async () => {
    await open(
      '/plans/' + PLAN.id,
      fakePlans({
        get: vi.fn(async () => ({
          ...PLAN,
          snapshot: {
            ...PLAN.snapshot,
            lossAtStopLoss: null,
            netRiskReward: null,
            estimatedEntryFee: null,
            feeShareOfRisk: null,
          },
        })),
      }),
    );
    const panel = within(
      await screen.findByRole('region', { name: 'Calculation snapshot' }),
    );
    expect(
      panel.getByText('Real loss at stop loss (USDT)').nextSibling?.textContent,
    ).toBe('—');
    expect(panel.getByText('R:R after fees').nextSibling?.textContent).toBe(
      '—',
    );
  });

  it('creates a Futures plan: market, direction and leverage', async () => {
    const service = fakePlans();
    await open('/plans/new', service);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('radio', { name: 'Futures' }));
    await user.click(screen.getByRole('radio', { name: 'Short' }));
    await user.type(screen.getByLabelText('Leverage'), '5');
    await typePrices(user, 'Entry price', '62000', '63000', '59000');
    await waitFor(() =>
      expect(service.calculate).toHaveBeenCalledWith(
        ROW.pairId,
        expect.objectContaining({
          market: 'futures',
          direction: 'SHORT',
          leverage: 5,
        }),
        expect.anything(),
      ),
    );
    expect(screen.queryByText(/leverage brackets are configured/)).toBeNull();
  });

  it('starts on the Futures pair the analysis screen links to', async () => {
    await open('/plans/new?market=futures&symbol=BTCUSDT', fakePlans());
    expect(
      (await screen.findByRole('radio', { name: 'Futures' })).getAttribute(
        'aria-checked',
      ),
    ).toBe('true');
    expect(screen.getByLabelText('Leverage')).toBeTruthy();
  });

  it('says the leverage is above the pair’s brackets on MSG15', async () => {
    const service = fakePlans({ calculate: refusedOn('leverage', 'MSG15') });
    await open('/plans/new?market=futures', service);
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('Leverage'), '125');
    await typePrices(user, 'Entry price', '62000', '61000', '65000');
    expect(
      await screen.findByText(
        'Leverage is above the maximum of this pair’s leverage brackets.',
      ),
    ).toBeTruthy();
  });
});
