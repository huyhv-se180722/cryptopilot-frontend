// @vitest-environment jsdom
import { beforeAll, describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminPackagesPage } from '../../pages/admin/AdminPackagesPage';
import type {
  AdminPackage,
  AdminPackageService,
  TierLimits,
} from '../../services/api/admin-packages';
import { ServiceError } from '../../services/api/errors';
import type { PlanTier, Session } from '../../types/domain';
import { fakeAuth, page, renderRoutes } from '../../test/render';

beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
});

const admin: Session = {
  user: {
    id: 'dev-admin',
    email: 'admin@dev.local',
    displayName: 'Dev Admin',
    role: 'Admin',
    status: 'active',
  },
  entitlements: 'unknown',
};
const signedIn = fakeAuth({ restoreSession: async () => admin });

const limits = (tier: PlanTier): TierLimits => ({
  futuresAnalysis: tier !== 'FREE',
  scoreComponents: tier !== 'FREE',
  activePlanMax: tier === 'FREE' ? 3 : tier === 'PRO' ? 20 : null,
  watchlistMax: tier === 'FREE' ? 5 : null,
  activeAlertMax: tier === 'FREE' ? 3 : 50,
  indicatorAlert: tier !== 'FREE',
  externalAlertChannels: tier !== 'FREE',
  advancedPerformance: tier !== 'FREE',
  newsAiInsight: true,
  aiDailyQuota: tier === 'FREE' ? 5 : 50,
  aiPerformanceContext: tier !== 'FREE',
  videoPost: tier === 'PREMIUM',
});

const pkg = (
  code: string,
  tier: PlanTier,
  patch: Partial<AdminPackage> = {},
): AdminPackage => ({
  id: 'id-' + code,
  code,
  name: code.replace('_', ' ').toLowerCase(),
  tier,
  tierRank: tier === 'FREE' ? 0 : tier === 'PRO' ? 1 : 2,
  price: tier === 'FREE' ? '0' : '99000.00',
  currency: 'VND',
  durationDays: tier === 'FREE' ? null : 30,
  purchasable: tier !== 'FREE',
  active: true,
  hasOrders: false,
  limits: limits(tier),
  updatedAt: '2026-11-22T03:00:00Z',
  ...patch,
});

const problem = (status: number, code: string) =>
  new ServiceError(code, 'HTTP_ERROR', status, {
    status,
    code,
    messageCode: 'MSG43',
    messageArgs: [],
    fieldErrors: {},
  });

/** In-memory `/admin/packages/**`: FREE, PRO_MONTHLY with orders, PRO_TRIAL without. */
function fakePackages() {
  let rows: AdminPackage[] = [
    pkg('FREE', 'FREE', { name: 'Free' }),
    pkg('PRO_MONTHLY', 'PRO', { name: 'Pro monthly', hasOrders: true }),
    pkg('PRO_TRIAL', 'PRO', { name: 'Pro trial' }),
  ];
  const calls: string[] = [];
  const find = (id: string) => {
    const row = rows.find((r) => r.id === id);
    if (!row) throw new Error('not found');
    return row;
  };
  const service: AdminPackageService = {
    list: async () => rows,
    create: async (input) => {
      calls.push('create ' + JSON.stringify(input));
      if (rows.some((r) => r.code === input.code))
        throw problem(409, 'PACKAGE_CODE_TAKEN');
      const created = pkg(input.code, input.tier, {
        name: input.name,
        price: String(input.price),
        durationDays: input.durationDays,
        purchasable: input.purchasable,
      });
      rows = [...rows, created];
      return created;
    },
    update: async (id, change) => {
      calls.push('update ' + id + ' ' + JSON.stringify(change));
      const next = { ...find(id), name: change.name };
      rows = rows.map((r) => (r.id === id ? next : r));
      return next;
    },
    setActive: async (id, active) => {
      calls.push('active ' + id + ' ' + active);
      const next = { ...find(id), active };
      rows = rows.map((r) => (r.id === id ? next : r));
      return next;
    },
    remove: async (id) => {
      calls.push('delete ' + id);
      if (find(id).hasOrders) throw problem(409, 'PACKAGE_IN_USE');
      rows = rows.filter((r) => r.id !== id);
    },
    saveTierLimits: async (tier, next) => {
      calls.push('limits ' + tier + ' ' + JSON.stringify(next));
      rows = rows.map((r) => (r.tier === tier ? { ...r, limits: next } : r));
      return rows.filter((r) => r.tier === tier);
    },
  };
  return { service, calls };
}

const open = (adminPackages: AdminPackageService) =>
  renderRoutes(
    [page('/admin/packages', <AdminPackagesPage />)],
    '/admin/packages',
    signedIn,
    { adminPackages },
  );

const table = () => within(screen.getByRole('table'));

describe('SCR-39 packages (UC-42)', () => {
  it('lists every package and the limits of each tier', async () => {
    await open(fakePackages().service);
    expect(await screen.findByText('Pro monthly')).toBeTruthy();
    expect(table().getAllByRole('row')).toHaveLength(4);
    const pro = within(screen.getByLabelText('Pro'));
    expect(pro.getByText('2 packages')).toBeTruthy();
    expect(pro.getAllByText('Unlimited')).toHaveLength(1);
    expect(
      within(screen.getByLabelText('Premium')).getByText(
        'No package of this plan yet.',
      ),
    ).toBeTruthy();
    // FREE can be renamed only: no deactivate or delete.
    expect(screen.queryByRole('button', { name: 'Deactivate Free' })).toBe(
      null,
    );
    expect(screen.queryByRole('button', { name: 'Delete Free' })).toBe(null);
    // A package with orders cannot be deleted.
    expect(
      (
        screen.getByRole('button', {
          name: 'Delete Pro monthly',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it('creates a paid package and shows a taken code under its field', async () => {
    const { service, calls } = fakePackages();
    await open(service);
    const user = userEvent.setup();
    await screen.findByText('Pro monthly');
    await user.click(screen.getByRole('button', { name: 'New package' }));
    const form = within(screen.getByRole('dialog', { name: 'New package' }));
    await user.type(form.getByLabelText('Code'), 'pro_trial');
    await user.type(form.getByLabelText('Name'), 'Pro trial 2');
    await user.type(form.getByLabelText('Price (VND)'), '49000');
    await user.click(form.getByRole('button', { name: 'Save' }));
    expect(
      await form.findByText('Another package already has this code.'),
    ).toBeTruthy();
    await user.clear(form.getByLabelText('Code'));
    await user.type(form.getByLabelText('Code'), 'PRO_WEEK');
    await user.clear(form.getByLabelText('Duration (days)'));
    await user.type(form.getByLabelText('Duration (days)'), '7');
    await user.click(form.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Pro trial 2')).toBeTruthy();
    expect(calls.at(-1)).toBe(
      'create {"code":"PRO_WEEK","name":"Pro trial 2","tier":"PRO","price":49000,"durationDays":7,"purchasable":true}',
    );
  });

  it('refuses a price of 0 before sending', async () => {
    const { service, calls } = fakePackages();
    await open(service);
    const user = userEvent.setup();
    await screen.findByText('Pro monthly');
    await user.click(screen.getByRole('button', { name: 'New package' }));
    const form = within(screen.getByRole('dialog', { name: 'New package' }));
    await user.type(form.getByLabelText('Code'), 'X');
    await user.type(form.getByLabelText('Name'), 'X');
    await user.type(form.getByLabelText('Price (VND)'), '0');
    await user.click(form.getByRole('button', { name: 'Save' }));
    expect(
      form.getByText('A whole number from 1 to 999,999,999,999.'),
    ).toBeTruthy();
    expect(calls).toEqual([]);
  });

  it('renames the FREE package without sending its offer', async () => {
    const { service, calls } = fakePackages();
    await open(service);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Edit Free' }));
    const form = within(screen.getByRole('dialog', { name: 'Edit Free' }));
    expect(form.queryByLabelText('Price (VND)')).toBe(null);
    await user.clear(form.getByLabelText('Name'));
    await user.type(form.getByLabelText('Name'), 'Basic');
    await user.click(form.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Basic')).toBeTruthy();
    expect(calls).toEqual(['update id-FREE {"name":"Basic"}']);
  });

  it('deactivates after a confirmation, then activates again', async () => {
    const { service, calls } = fakePackages();
    await open(service);
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole('button', { name: 'Deactivate Pro trial' }),
    );
    const confirm = within(
      screen.getByRole('dialog', { name: 'Deactivate Pro trial?' }),
    );
    await user.click(confirm.getByRole('button', { name: 'Deactivate' }));
    await user.click(
      await screen.findByRole('button', { name: 'Activate Pro trial' }),
    );
    expect(
      await screen.findByRole('button', { name: 'Deactivate Pro trial' }),
    ).toBeTruthy();
    expect(calls).toEqual([
      'active id-PRO_TRIAL false',
      'active id-PRO_TRIAL true',
    ]);
  });

  it('deletes a package without orders', async () => {
    const { service } = fakePackages();
    await open(service);
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole('button', { name: 'Delete Pro trial' }),
    );
    const confirm = within(
      screen.getByRole('dialog', { name: 'Delete Pro trial?' }),
    );
    await user.click(confirm.getByRole('button', { name: 'Delete' }));
    await screen.findByText('Pro trial was deleted.');
    expect(table().queryByText('Pro trial')).toBe(null);
  });

  it('saves the limits of a tier, an empty count as no limit', async () => {
    const { service, calls } = fakePackages();
    await open(service);
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole('button', { name: 'Edit limits Pro' }),
    );
    const form = within(
      screen.getByRole('dialog', { name: 'Limits of the Pro plan' }),
    );
    await user.clear(form.getByLabelText('Active trading plans'));
    await user.click(form.getByLabelText('Video posts'));
    await user.click(form.getByRole('button', { name: 'Save' }));
    await screen.findByText('The limits of the Pro plan were saved.');
    const saved = JSON.parse(calls.at(-1)!.replace('limits PRO ', ''));
    expect(saved).toMatchObject({ activePlanMax: null, videoPost: true });
    expect(
      within(screen.getByLabelText('Pro')).getAllByText('Unlimited'),
    ).toHaveLength(2);
  });
});
