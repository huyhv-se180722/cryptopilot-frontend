// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createDevelopmentAdminDashboard } from '../../dev/dev-admin-dashboard';
import { AdminOverviewPage } from '../../pages/admin/AdminOverviewPage';
import type { AdminDashboardService } from '../../services/api/contracts';
import type { Session } from '../../types/domain';
import { fakeAuth, page, renderRoutes } from '../../test/render';

const admin: Session = {
  user: {
    id: 'test-admin',
    email: 'admin@example.test',
    displayName: 'Test Admin',
    role: 'Admin',
    status: 'active',
  },
  entitlements: 'unknown',
};

const open = (service: AdminDashboardService) =>
  renderRoutes(
    [page('/admin', <AdminOverviewPage />)],
    '/admin',
    fakeAuth({ restoreSession: async () => admin }),
    { adminDashboard: service },
  );

afterEach(() => vi.restoreAllMocks());

describe('SCR-33 admin overview (UC-40, UC-41)', () => {
  it('shows the indicators of now and of the period, revenue in VND by package', async () => {
    await open(createDevelopmentAdminDashboard());
    expect(
      (await screen.findByText('Total users')).nextSibling?.textContent,
    ).toBe('45');
    expect(screen.getByText('Revenue').nextSibling?.textContent).toBe(
      '6,158,000',
    );
    expect(screen.getByText('Signed in during the last 7 days')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Review' })).toBeTruthy();
    expect(screen.getByText('PREMIUM_YEARLY')).toBeTruthy();
    expect(screen.getByText(/^Business days .* UTC\+7\.$/)).toBeTruthy();
  });

  it('asks for the chosen period and groups the report by week', async () => {
    const service = createDevelopmentAdminDashboard();
    const dashboard = vi.spyOn(service, 'dashboard');
    const report = vi.spyOn(service, 'report');
    await open(service);
    const user = userEvent.setup();
    await screen.findByText('Total users');
    await user.click(screen.getByRole('radio', { name: '7 days' }));
    await waitFor(() => {
      const period = dashboard.mock.calls.at(-1)?.[0];
      expect(
        (Date.parse(period?.to ?? '') - Date.parse(period?.from ?? '')) /
          86_400_000,
      ).toBe(6);
    });
    await user.click(screen.getByRole('radio', { name: 'Week' }));
    await waitFor(() => expect(report.mock.calls.at(-1)?.[1]).toBe('WEEK'));
    const table = within(
      await screen.findByRole('table', {
        name: 'Management report of the period',
      }),
    );
    expect(table.getByRole('columnheader', { name: 'PRO_MONTHLY (VND)' }));
  });

  it('saves the report as a CSV file', async () => {
    const created = vi.fn(() => 'blob:report');
    Object.assign(URL, {
      createObjectURL: created,
      revokeObjectURL: vi.fn(),
    });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    await open(createDevelopmentAdminDashboard());
    await userEvent
      .setup()
      .click(await screen.findByRole('button', { name: 'Export CSV' }));
    await waitFor(() => expect(click).toHaveBeenCalled());
    expect(created).toHaveBeenCalled();
    const link = click.mock.contexts[0] as HTMLAnchorElement;
    expect(link.download).toMatch(/^cryptopilot-report-.+-day\.csv$/);
  });

  it('offers to try again when the indicators cannot be read', async () => {
    const service = createDevelopmentAdminDashboard();
    vi.spyOn(service, 'dashboard').mockRejectedValue(new Error('offline'));
    await open(service);
    expect(
      await screen.findByRole('button', { name: 'Try again' }),
    ).toBeTruthy();
  });
});
