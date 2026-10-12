// @vitest-environment jsdom
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlanDetailPage } from '../../pages/trader/PlanDetailPage';
import { PlansPage } from '../../pages/trader/PlansPage';
import type { TradingPlanService } from '../../services/api/contracts';
import { ServiceError } from '../../services/api/errors';
import type {
  PlanEntitlements,
  Session,
  TradingPlan,
  TradingPlanSummary,
} from '../../types/domain';
import { fakeAuth, page, renderRoutes, testTrader } from '../../test/render';

// jsdom has no modal dialog; the component only needs open/close.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
});

const ROW: TradingPlanSummary = {
  id: '0199a2c4-0000-7000-8000-00000000a1b2',
  pairId: '0199a0f0-1111-7aaa-8bbb-000000000001',
  market: 'futures',
  direction: 'SHORT',
  entryType: 'LIMIT',
  entryPrice: '62000.000000000000',
  stopLoss: '63000.000000000000',
  takeProfit: '59000.000000000000',
  leverage: 5,
  riskAmount: '10.00000000',
  riskRewardRatio: '3.00000000',
  status: 'DRAFT',
  createdAt: '2026-10-08T02:20:00Z',
  activatedAt: null,
  expiresAt: '2026-10-15T02:20:00Z',
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
  capital: '1000',
  riskPercent: '1',
  leverage: 5,
  marginMode: 'ISOLATED',
  expiresAt: '2026-10-15T02:20:00Z',
  note: 'Retest of the range high.',
  status: 'DRAFT',
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
  },
  warnings: [
    { type: 'HIGH_LEVERAGE', severity: 'WARNING' },
    { type: 'WIDE_STOP_LOSS', severity: 'INFO' },
  ],
  blocksActivation: false,
  statusHistory: [{ status: 'DRAFT', at: '2026-10-08T02:20:00Z' }],
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
    ...overrides,
  };
  return service;
}

async function open(
  path: string,
  service = fakePlans(),
  tier: 'FREE' | 'PRO' = 'FREE',
) {
  const session: Session = { ...testTrader, entitlements: plan(tier) };
  await renderRoutes(
    [page('/plans', <PlansPage />), page('/plans/:planId', <PlanDetailPage />)],
    path,
    fakeAuth({ restoreSession: async () => session }),
    { tradingPlan: service },
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
    // FEQ-01: no pair symbol yet, and the screen says why.
    expect(cells.getByTitle('Pair name not available')).toBeTruthy();
    expect(
      screen.getByText(/Pair names are not returned by the server yet/),
    ).toBeTruthy();
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
    await open('/plans/' + PLAN.id);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Plan 0000a1b2' }),
    ).toBeTruthy();
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
