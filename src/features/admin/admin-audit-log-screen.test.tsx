// @vitest-environment jsdom
import { beforeAll, describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createDevelopmentAdminAudit } from '../../dev/dev-admin-audit';
import { AdminAuditLogPage } from '../../pages/admin/AdminAuditLogPage';
import type { AdminAuditService } from '../../services/api/contracts';
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

const open = (path = '/admin/audit-log', adminAudit?: AdminAuditService) =>
  renderRoutes(
    [page('/admin/audit-log', <AdminAuditLogPage />)],
    path,
    signedIn,
    {
      adminAudit: adminAudit ?? createDevelopmentAdminAudit(),
    },
  );

const tableRows = () =>
  within(screen.getByRole('table')).getAllByRole('row').slice(1);

describe('SCR-44 audit log (UC-46)', () => {
  it('shows each service with its status in words, and the feeds', async () => {
    await open();
    const ai = await screen.findByRole('listitem', {
      name: 'AI Service: Down',
    });
    expect(
      within(ai).getByText('the AI Service did not answer in 20 s'),
    ).toBeTruthy();
    expect(
      screen.getByRole('listitem', { name: 'News sources (RSS): Degraded' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('listitem', { name: 'Media storage: No data yet' }),
    ).toBeTruthy();
    const futures = screen.getByRole('listitem', { name: 'Futures' });
    expect(within(futures).getByText('Stale')).toBeTruthy();
    expect(within(futures).getByText(/Behind by 12 min/)).toBeTruthy();
  });

  it('lists the audit trail 20 a page, newest first, with actor and change', async () => {
    await open();
    expect(await screen.findByText('44 entries')).toBeTruthy();
    expect(tableRows()).toHaveLength(20);
    const first = tableRows()[0] as HTMLElement;
    expect(within(first).getByText('Role changed')).toBeTruthy();
    expect(within(first).getByText('You')).toBeTruthy();
    expect(within(first).getByText('TRADER')).toBeTruthy();
    expect(within(first).getByText('ADMIN')).toBeTruthy();
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Page 3' }));
    await waitFor(() => expect(tableRows()).toHaveLength(4));
  });

  it('filters by action, actor and who recorded it, and clears', async () => {
    await open();
    const user = userEvent.setup();
    await screen.findByText('44 entries');
    await user.selectOptions(screen.getByLabelText('Action'), 'ACCOUNT_BANNED');
    expect(await screen.findByText('1 entry')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    await user.click(screen.getByRole('radio', { name: 'System' }));
    expect(await screen.findByText('6 entries')).toBeTruthy();
    expect(
      tableRows().every((row) => within(row).queryByText('System') !== null),
    ).toBe(true);
    await user.click(screen.getByRole('radio', { name: 'Anyone' }));
    await user.type(screen.getByLabelText('Actor'), 'khoa');
    expect(await screen.findByText('13 entries')).toBeTruthy();
    await user.type(screen.getByLabelText('Actor'), ' nobody');
    expect(
      await screen.findByText('No entry matches these filters.'),
    ).toBeTruthy();
  });

  it('refuses a period that runs backwards before asking the server', async () => {
    await open();
    const user = userEvent.setup();
    await screen.findByText('44 entries');
    const panel = screen.getByRole('tabpanel');
    await user.type(within(panel).getByLabelText('From'), '2026-11-03');
    await user.type(within(panel).getByLabelText('To'), '2026-11-01');
    expect(
      await screen.findByText('The first day is after the last day.'),
    ).toBeTruthy();
    expect(screen.getByText('44 entries')).toBeTruthy();
  });

  it('opens an entry with every field before and after, and narrows to its object', async () => {
    await open();
    const user = userEvent.setup();
    await screen.findByText('44 entries');
    await user.click(tableRows()[0] as HTMLElement);
    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByText('Reason: Bổ sung người kiểm duyệt ca tối'),
    ).toBeTruthy();
    const role = within(dialog).getByRole('rowheader', { name: 'role' });
    const cells = within(role.closest('tr') as HTMLElement).getAllByRole(
      'cell',
    );
    expect(cells.map((cell) => cell.textContent)).toEqual(['TRADER', 'ADMIN']);
    expect(
      within(dialog).getByRole('link', { name: /Open/ }).getAttribute('href'),
    ).toBe('/admin/users/0199a0f0-0000-7000-8000-000000000003');
    await user.click(
      within(dialog).getByRole('button', { name: /History of this object/ }),
    );
    expect(await screen.findByText('7 entries')).toBeTruthy();
    expect(screen.getByText(/Account: 0199a0f0/)).toBeTruthy();
  });

  it('opens on one actor from a link', async () => {
    await open('/admin/audit-log?actorId=0199a0f0-0000-7000-8000-00000000a002');
    expect(await screen.findByText('13 entries')).toBeTruthy();
  });

  it('shows the system log in its tab, a repeat as one row with its count', async () => {
    await open('/admin/audit-log?tab=events');
    expect(await screen.findByText('9 failures')).toBeTruthy();
    expect(screen.getByText('×37')).toBeTruthy();
    const user = userEvent.setup();
    await user.click(screen.getByRole('radio', { name: 'System error' }));
    expect(await screen.findByText('4 failures')).toBeTruthy();
    await user.click(screen.getByText('POST /api/v1/plans'));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Error reference')).toBeTruthy();
    expect(
      within(dialog).getByText('0199b1c2-ef01-7000-8000-00000000beef'),
    ).toBeTruthy();
  });
});
