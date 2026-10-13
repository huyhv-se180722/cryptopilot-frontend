// @vitest-environment jsdom
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AlertsPage } from '../../pages/trader/AlertsPage';
import { WatchlistPage } from '../../pages/trader/WatchlistPage';
import type {
  AlertsService,
  WatchlistService,
} from '../../services/api/contracts';
import { ServiceError } from '../../services/api/errors';
import type {
  Alert,
  PlanEntitlements,
  Session,
  WatchlistItem,
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

const refusal = (
  status: number,
  code: string,
  messageCode: string,
  args: string[] = [],
  fieldErrors: Record<string, string> = {},
) =>
  new ServiceError('refused', 'HTTP_ERROR', status, {
    status,
    code,
    messageCode,
    messageArgs: args,
    fieldErrors,
  });

const row = (
  n: number,
  symbol: string,
  label: string | null,
  extra: Partial<WatchlistItem> = {},
): WatchlistItem => ({
  id: 'row-' + n,
  pairId: 'pair-' + n,
  symbol,
  spotListed: true,
  futuresListed: true,
  label,
  note: null,
  sortOrder: n - 1,
  activeAlerts: 0,
  addedAt: '2026-10-01T00:00:00Z',
  ...extra,
});

const ROWS = [
  row(1, 'DOGEUSDT', null),
  row(2, 'BTCUSDT', 'Majors', { activeAlerts: 2, note: 'Range high' }),
  row(3, 'ETHUSDT', 'Majors'),
  row(4, 'MATICUSDT', null, { spotListed: false, futuresListed: false }),
];

const ALERT: Alert = {
  id: 'alert-1',
  watchlistId: 'row-2',
  pairId: 'pair-2',
  symbol: 'BTCUSDT',
  market: 'spot',
  type: 'PRICE',
  indicator: null,
  timeframe: null,
  condition: 'CROSS_ABOVE',
  threshold: '65000.000000000000',
  triggerMode: 'ONCE',
  cooldownMinutes: null,
  notifyEmail: false,
  notifyPush: false,
  expiresAt: null,
  status: 'ACTIVE',
  triggerCount: 0,
  lastTriggeredAt: null,
  createdAt: '2026-10-02T00:00:00Z',
};
const OI_ALERT: Alert = {
  ...ALERT,
  id: 'alert-2',
  pairId: 'pair-3',
  watchlistId: 'row-3',
  symbol: 'ETHUSDT',
  market: 'futures',
  type: 'INDICATOR',
  indicator: 'OPEN_INTEREST_CHANGE',
  timeframe: '1h',
  condition: 'GREATER_THAN',
  threshold: '5.000000000000',
  status: 'PAUSED',
};

const FUNDING_ALERT: Alert = {
  ...OI_ALERT,
  id: 'alert-3',
  pairId: 'pair-1',
  watchlistId: 'row-1',
  symbol: 'DOGEUSDT',
  indicator: 'FUNDING_RATE',
  condition: 'LESS_THAN',
  // Stored as a fraction: -0.005 %.
  threshold: '-0.000050000000',
  status: 'ACTIVE',
};

function fakeWatchlist(overrides: Partial<WatchlistService> = {}) {
  const service: WatchlistService = {
    get: vi.fn(async () => ({ items: ROWS, limit: 5 })),
    add: vi.fn(),
    update: vi.fn(async (id) => ROWS.find((item) => item.id === id)!),
    remove: vi.fn(async () => undefined),
    ...overrides,
  };
  return service;
}

function fakeAlerts(overrides: Partial<AlertsService> = {}) {
  const service: AlertsService = {
    list: vi.fn(async (query) => ({
      items: [ALERT, OI_ALERT, FUNDING_ALERT],
      page: query.page,
      pageSize: 20,
      total: 3,
    })),
    create: vi.fn(async () => ALERT),
    update: vi.fn(async () => ALERT),
    remove: vi.fn(async () => undefined),
    pause: vi.fn(async () => ({ ...ALERT, status: 'PAUSED' as const })),
    resume: vi.fn(async () => ALERT),
    ...overrides,
  };
  return service;
}

const entitlements = (tier: 'FREE' | 'PRO'): PlanEntitlements => ({
  tier,
  features:
    tier === 'PRO'
      ? ['INDICATOR_ALERT', 'FUTURES_ANALYSIS', 'EXTERNAL_ALERT_CHANNELS']
      : [],
  limits: { WATCHLIST_MAX: tier === 'FREE' ? 5 : 50 },
});

async function open(
  path: string,
  {
    watchlist = fakeWatchlist(),
    alerts = fakeAlerts(),
    tier = 'PRO',
  }: {
    watchlist?: WatchlistService;
    alerts?: AlertsService;
    tier?: 'FREE' | 'PRO';
  } = {},
) {
  const session: Session = { ...testTrader, entitlements: entitlements(tier) };
  await renderRoutes(
    [page('/watchlist', <WatchlistPage />), page('/alerts', <AlertsPage />)],
    path,
    fakeAuth({ restoreSession: async () => session }),
    { watchlist, alerts },
  );
  return { watchlist, alerts, user: userEvent.setup() };
}

describe('SCR-12 watchlist (T-059)', () => {
  it('groups rows by label with unlabelled rows last and shows n / limit', async () => {
    await open('/watchlist');
    const groups = await screen.findAllByRole('region');
    expect(groups.map((group) => group.getAttribute('aria-label'))).toEqual([
      'Majors',
      'No label',
    ]);
    expect(screen.getByText('4 / 5 pairs')).toBeTruthy();
    const majors = within(groups[0]!);
    expect(majors.getByRole('link', { name: 'BTC/USDT' })).toBeTruthy();
    expect(majors.getByText('Range high')).toBeTruthy();
    expect(majors.getByText('2 active')).toBeTruthy();
    // A pair an admin disabled stays, without a link (Q-29).
    const unlabelled = within(groups[1]!);
    expect(unlabelled.getByText('Not listed')).toBeTruthy();
    expect(unlabelled.queryByRole('link', { name: 'MATIC/USDT' })).toBeNull();
    // Adding waits for pair ids (FEQ-01).
    expect(
      (screen.getByRole('button', { name: 'Add pair' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it('asks MSG26 with the server count and asks again when it changed (D-76)', async () => {
    const remove = vi
      .fn<WatchlistService['remove']>()
      .mockRejectedValueOnce(
        refusal(400, 'WATCHLIST_REMOVAL_CONFIRMATION_REQUIRED', 'MSG26', [
          'BTCUSDT',
          '3',
        ]),
      )
      .mockRejectedValueOnce(
        refusal(400, 'WATCHLIST_REMOVAL_CONFIRMATION_REQUIRED', 'MSG26', [
          'BTCUSDT',
          '4',
        ]),
      )
      .mockResolvedValueOnce(undefined);
    const { user } = await open('/watchlist', {
      watchlist: fakeWatchlist({ remove }),
    });
    await user.click(
      await screen.findByRole('button', { name: 'Actions for BTC/USDT' }),
    );
    await user.click(
      screen.getByRole('menuitem', { name: 'Remove from watchlist' }),
    );
    const dialog = within(await screen.findByRole('dialog'));
    expect(
      dialog.getByText(
        'Removing BTC/USDT will also delete 3 alerts. Continue?',
      ),
    ).toBeTruthy();
    await user.click(dialog.getByRole('button', { name: 'Remove' }));
    expect(
      await dialog.findByText(
        'Removing BTC/USDT will also delete 4 alerts. Continue?',
      ),
    ).toBeTruthy();
    await user.click(dialog.getByRole('button', { name: 'Remove' }));
    expect(
      await screen.findByText('BTC/USDT removed from watchlist.'),
    ).toBeTruthy();
    expect(remove.mock.calls).toEqual([
      ['row-2', undefined],
      ['row-2', 3],
      ['row-2', 4],
    ]);
  });

  it('saves a trimmed label and note (MSG14) and moves a row within its group', async () => {
    const { watchlist, user } = await open('/watchlist');
    await user.click(
      await screen.findByRole('button', { name: 'Actions for BTC/USDT' }),
    );
    await user.click(
      screen.getByRole('menuitem', { name: 'Edit label and note' }),
    );
    const dialog = within(await screen.findByRole('dialog'));
    const label = dialog.getByLabelText('Label');
    await user.clear(label);
    await user.type(label, '  Core  ');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Saved successfully.')).toBeTruthy();
    expect(watchlist.update).toHaveBeenCalledWith('row-2', {
      label: 'Core',
      note: 'Range high',
    });

    vi.mocked(watchlist.update).mockClear();
    await user.click(
      screen.getByRole('button', { name: 'Actions for BTC/USDT' }),
    );
    await user.click(screen.getByRole('menuitem', { name: 'Move down' }));
    // Display order Majors (ETH, BTC) then No label (DOGE, MATIC) → 0…3;
    // only the rows whose position changed are sent.
    await waitFor(() =>
      expect(vi.mocked(watchlist.update).mock.calls).toEqual([
        ['row-3', { sortOrder: 0 }],
        ['row-1', { sortOrder: 2 }],
      ]),
    );
  });

  it('opens SCR-14 on the row pair and creates a price alert', async () => {
    const { alerts, user } = await open('/watchlist');
    await user.click(
      await screen.findByRole('button', { name: 'Create alert for ETH/USDT' }),
    );
    const dialog = within(await screen.findByRole('dialog'));
    await user.click(screen.getByRole('button', { name: 'Save alert' }));
    expect(
      await dialog.findByText('The target price (usdt) field is required.'),
    ).toBeTruthy();
    expect(alerts.create).not.toHaveBeenCalled();
    await user.type(dialog.getByLabelText('Target price (USDT)'), '2600.5');
    await user.click(dialog.getByRole('radio', { name: 'Every time' }));
    await user.type(dialog.getByLabelText('Cooldown (minutes)'), '15');
    await user.click(screen.getByRole('button', { name: 'Save alert' }));
    expect(await screen.findByText('Saved successfully.')).toBeTruthy();
    expect(alerts.create).toHaveBeenCalledWith('pair-3', {
      market: 'spot',
      type: 'PRICE',
      indicator: null,
      timeframe: null,
      condition: 'CROSS_ABOVE',
      threshold: '2600.5',
      triggerMode: 'EVERY_TIME',
      cooldownMinutes: 15,
      notifyEmail: false,
      notifyPush: false,
      expiresAt: null,
    });
  });
});

describe('SCR-14 alert dialog (T-059)', () => {
  it('locks indicator, Futures and external channels on FREE (CR-08, MSG29)', async () => {
    const { user } = await open('/watchlist', { tier: 'FREE' });
    await user.click(
      await screen.findByRole('button', { name: 'Create alert for BTC/USDT' }),
    );
    const dialog = within(await screen.findByRole('dialog'));
    await user.click(dialog.getByRole('radio', { name: 'Indicator' }));
    expect(
      dialog.getByText(
        'This feature is available on the PRO plan or higher. View plans?',
      ),
    ).toBeTruthy();
    expect(
      dialog.getByRole('radio', { name: 'Price' }).getAttribute('aria-checked'),
    ).toBe('true');
    expect(
      (dialog.getByRole('checkbox', { name: /Email/ }) as HTMLInputElement)
        .disabled,
    ).toBe(true);
  });

  it('checks the RSI range', async () => {
    const { alerts, user } = await open('/watchlist');
    await user.click(
      await screen.findByRole('button', { name: 'Create alert for BTC/USDT' }),
    );
    const dialog = within(await screen.findByRole('dialog'));
    await user.click(dialog.getByRole('radio', { name: 'Indicator' }));
    await user.type(dialog.getByLabelText('RSI level'), '120');
    await user.click(screen.getByRole('button', { name: 'Save alert' }));
    expect(
      await dialog.findByText('RSI level must be between 0 and 100.'),
    ).toBeTruthy();
    expect(alerts.create).not.toHaveBeenCalled();
  });

  it('takes a funding rate threshold in percent and sends a fraction (D-100)', async () => {
    const { alerts, user } = await open('/watchlist');
    await user.click(
      await screen.findByRole('button', { name: 'Create alert for ETH/USDT' }),
    );
    const dialog = within(await screen.findByRole('dialog'));
    await user.click(dialog.getByRole('radio', { name: 'Futures' }));
    await user.click(dialog.getByRole('radio', { name: 'Indicator' }));
    await user.selectOptions(
      dialog.getByLabelText('Indicator'),
      'FUNDING_RATE',
    );
    await user.selectOptions(
      dialog.getByLabelText('Condition'),
      'GREATER_THAN',
    );
    await user.type(dialog.getByLabelText('Funding rate (%)'), '0.01');
    await user.click(screen.getByRole('button', { name: 'Save alert' }));
    expect(await screen.findByText('Saved successfully.')).toBeTruthy();
    expect(alerts.create).toHaveBeenCalledWith(
      'pair-3',
      expect.objectContaining({
        market: 'futures',
        indicator: 'FUNDING_RATE',
        timeframe: null,
        condition: 'GREATER_THAN',
        threshold: '0.0001',
      }),
    );
  });

  it('edits a Futures indicator alert without sending the server-set timeframe', async () => {
    const update = vi
      .fn<AlertsService['update']>()
      .mockRejectedValueOnce(
        refusal(400, 'VALIDATION_FAILED', 'MSG01', [], {
          threshold: 'MSG15',
        }),
      )
      .mockResolvedValueOnce(OI_ALERT);
    const { user } = await open('/alerts', {
      alerts: fakeAlerts({ update }),
    });
    await user.click(
      await screen.findByRole('button', {
        name: 'Actions for the ETH/USDT alert',
      }),
    );
    await user.click(screen.getByRole('menuitem', { name: 'Edit' }));
    const dialog = within(await screen.findByRole('dialog'));
    const threshold = dialog.getByLabelText('Change over 1 hour (%)');
    expect((threshold as HTMLInputElement).value).toBe('5');
    await user.click(screen.getByRole('button', { name: 'Save alert' }));
    expect(
      await dialog.findByText('Change over 1 hour (%) must be greater than 0.'),
    ).toBeTruthy();
    expect(update.mock.calls[0]?.[1]).toMatchObject({
      market: 'futures',
      indicator: 'OPEN_INTEREST_CHANGE',
      timeframe: null,
      threshold: '5',
    });
  });
});

describe('SCR-13 alert list (T-059)', () => {
  it('words the conditions and keeps the status filter in the URL', async () => {
    const { alerts, user } = await open('/alerts');
    const table = within(
      await screen.findByRole('region', { name: 'Your alerts' }),
    );
    expect(table.getByText('Crosses above 65,000.00')).toBeTruthy();
    expect(
      table.getByText('Open interest change (1h) · Greater than 5%'),
    ).toBeTruthy();
    expect(table.getByText('Funding rate · Less than -0.005%')).toBeTruthy();
    expect(table.getByText('Paused')).toBeTruthy();
    await user.selectOptions(screen.getByLabelText('Status'), 'PAUSED');
    await waitFor(() =>
      expect(vi.mocked(alerts.list).mock.calls.at(-1)?.[0]).toEqual({
        page: 1,
        pageSize: 20,
        status: 'PAUSED',
      }),
    );
  });

  it('pauses, shows MSG27 with the plans link on a refused resume, and deletes after a confirmation', async () => {
    const resume = vi
      .fn<AlertsService['resume']>()
      .mockRejectedValue(
        refusal(409, 'PLAN_LIMIT_REACHED', 'MSG27', [
          '3',
          'active alerts',
          'FREE',
        ]),
      );
    const { alerts, user } = await open('/alerts', {
      alerts: fakeAlerts({ resume }),
    });
    await user.click(
      await screen.findByRole('button', {
        name: 'Actions for the BTC/USDT alert',
      }),
    );
    await user.click(screen.getByRole('menuitem', { name: 'Pause' }));
    expect(await screen.findByText('Alert paused.')).toBeTruthy();
    expect(alerts.pause).toHaveBeenCalledWith('alert-1');

    await user.click(
      screen.getByRole('button', { name: 'Actions for the ETH/USDT alert' }),
    );
    await user.click(screen.getByRole('menuitem', { name: 'Resume' }));
    expect(
      await screen.findByText(
        'You have reached the limit of 3 active alerts of the FREE plan. Upgrade to increase the limit?',
      ),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'View plans' })).toBeTruthy();

    await user.click(
      screen.getByRole('button', { name: 'Actions for the BTC/USDT alert' }),
    );
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
    const dialog = within(await screen.findByRole('dialog'));
    expect(
      dialog.getByText(
        'Delete the Crosses above 65,000.00 alert on BTC/USDT? This cannot be undone.',
      ),
    ).toBeTruthy();
    await user.click(dialog.getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText('Alert deleted.')).toBeTruthy();
    expect(alerts.remove).toHaveBeenCalledWith('alert-1');
  });
});
