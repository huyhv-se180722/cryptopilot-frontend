// @vitest-environment jsdom
import { beforeAll, describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createDevelopmentAdminUsers } from '../../dev/dev-admin-users';
import { AdminUserPage } from '../../pages/admin/AdminUserPage';
import { AdminUsersPage } from '../../pages/admin/AdminUsersPage';
import { ServiceError } from '../../services/api/errors';
import type { AdminUserService } from '../../services/api/contracts';
import type { Session } from '../../types/domain';
import { fakeAuth, page, renderRoutes } from '../../test/render';

beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
});

/** The fixture's first administrator. */
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
const trader = '0199a0f0-0000-7000-8000-000000000001';

const open = (path: string, adminUsers?: AdminUserService) =>
  renderRoutes(
    [
      page('/admin/users', <AdminUsersPage />),
      page('/admin/users/:userId', <AdminUserPage />),
    ],
    path,
    signedIn,
    {
      adminUsers: adminUsers ?? createDevelopmentAdminUsers(async () => admin),
    },
  );

const rows = () =>
  within(screen.getByRole('table')).getAllByRole('row').slice(1);

describe('SCR-34 users (UC-42)', () => {
  it('lists 20 accounts a page, newest first, with the total', async () => {
    await open('/admin/users');
    expect(await screen.findByText('45 accounts')).toBeTruthy();
    expect(rows()).toHaveLength(20);
    expect(screen.getByText('Page 1 of 3')).toBeTruthy();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('Page 2 of 3')).toBeTruthy();
  });

  it('searches and filters on the server, back on the first page', async () => {
    await open('/admin/users');
    const user = userEvent.setup();
    await screen.findByText('45 accounts');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByText('Page 2 of 3');
    await user.selectOptions(screen.getByLabelText('Status'), 'banned');
    expect(await screen.findByText('3 accounts')).toBeTruthy();
    expect(screen.queryByText(/^Page /)).toBe(null);
    expect(
      rows().every((row) => within(row).queryByText('Banned') !== null),
    ).toBe(true);

    await user.selectOptions(screen.getByLabelText('Status'), '');
    await user.type(screen.getByLabelText('Search'), 'no such person');
    expect(
      await screen.findByText('No account matches these filters'),
    ).toBeTruthy();
  });

  it('tags the signed-in administrator and opens an account', async () => {
    await open('/admin/users');
    const user = userEvent.setup();
    await user.selectOptions(await screen.findByLabelText('Role'), 'Admin');
    expect(await screen.findByText('2 accounts')).toBeTruthy();
    const own = rows().find((row) => within(row).queryByText('You'));
    expect(own?.textContent).toContain('admin@dev.local');
    await user.click(
      screen.getByRole('link', {
        name: 'Open second.admin@cryptopilot.invalid',
      }),
    );
    expect(
      await screen.findByRole('heading', { name: 'Second Admin' }),
    ).toBeTruthy();
  });
});

describe('SCR-35 user detail (UC-42)', () => {
  it('shows the plan, activity and profile of the account', async () => {
    await open('/admin/users/' + trader);
    expect(
      await screen.findByRole('heading', { name: 'Alex Morgan' }),
    ).toBeTruthy();
    const stats = within(screen.getByRole('region', { name: 'Activity' }));
    expect(stats.getByText('Current plan')).toBeTruthy();
    expect(stats.getByText('Trading plans')).toBeTruthy();
    expect(stats.getByText('Posts')).toBeTruthy();
    expect(screen.getByText('Swing')).toBeTruthy();
    expect(screen.getByText('Balanced')).toBeTruthy();
    expect(screen.getByText('No audit entries yet.')).toBeTruthy();
  });

  it('locks with a required reason and records it in the audit', async () => {
    await open('/admin/users/' + trader);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Lock' }));
    const dialog = within(
      screen.getByRole('dialog', {
        name: 'Lock account alex.morgan1@example.test?',
      }),
    );
    await user.click(dialog.getByRole('button', { name: 'Lock' }));
    expect(dialog.getByText('Enter the reason.')).toBeTruthy();
    await user.type(dialog.getByLabelText('Reason'), 'Chargeback dispute');
    await user.click(dialog.getByRole('button', { name: 'Lock' }));

    expect(
      await screen.findByText('Account locked; its sessions ended.'),
    ).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBe(null);
    expect(screen.getByRole('button', { name: 'Unlock' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Lock' })).toBe(null);
    const audit = within(
      screen.getByRole('table', { name: 'Audit entries of this account' }),
    );
    expect(audit.getByText('Locked')).toBeTruthy();
    expect(audit.getByText('status: ACTIVE → LOCKED')).toBeTruthy();
    expect(audit.getByText('Reason: Chargeback dispute')).toBeTruthy();
    expect(audit.getByText('You')).toBeTruthy();
  });

  it('refuses a reason over 500 characters before sending', async () => {
    await open('/admin/users/' + trader);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Ban' }));
    const dialog = within(screen.getByRole('dialog'));
    const reason = dialog.getByLabelText('Reason');
    await user.click(reason);
    await user.paste('x'.repeat(501));
    expect(
      dialog.getByText('The reason has at most 500 characters.'),
    ).toBeTruthy();
    expect(dialog.getByText('501/500')).toBeTruthy();
  });

  it('keeps the dialog open with the MSG39 refusal', async () => {
    const service = createDevelopmentAdminUsers(async () => admin);
    await open('/admin/users/' + trader, {
      ...service,
      changeRole: async () => {
        throw new ServiceError('refused', 'HTTP_ERROR', 409, {
          status: 409,
          code: 'ACCOUNT_STATUS_TRANSITION_INVALID',
          messageCode: 'MSG39',
          messageArgs: [],
          fieldErrors: {},
        });
      },
    });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Make Admin' }));
    const dialog = within(screen.getByRole('dialog'));
    await user.type(dialog.getByLabelText('Reason'), 'Moderator');
    await user.click(dialog.getByRole('button', { name: 'Make Admin' }));
    expect(
      await dialog.findByText(/^Refused: an administrator cannot change/),
    ).toBeTruthy();
  });

  it('offers no change on one’s own account (BR-58)', async () => {
    await open('/admin/users/dev-admin');
    expect(
      await screen.findByText(
        'This is your own account. Another administrator changes its status or role (BR-58).',
      ),
    ).toBeTruthy();
    for (const name of ['Lock', 'Ban', 'Make Trader'])
      expect(screen.queryByRole('button', { name })).toBe(null);
  });

  it('says so for an unknown account', async () => {
    await open('/admin/users/unknown');
    expect(
      await screen.findByText('This account does not exist.'),
    ).toBeTruthy();
  });
});
