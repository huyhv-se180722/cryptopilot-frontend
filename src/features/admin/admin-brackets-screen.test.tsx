// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createDevelopmentAdminPairs } from '../../dev/dev-admin-pairs';
import { AdminBracketsPage } from '../../pages/admin/AdminBracketsPage';
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

const open = (path: string) =>
  renderRoutes(
    [page('/admin/leverage-brackets', <AdminBracketsPage />)],
    path,
    fakeAuth({ restoreSession: async () => admin }),
    { adminPairs: createDevelopmentAdminPairs() },
  );

describe('SCR-38 leverage brackets (UC-46)', () => {
  it('opens on the pair asked for, with each bracket from the cap before it', async () => {
    await open('/admin/leverage-brackets?pair=ETHUSDT');
    const table = within(
      await screen.findByRole('region', {
        name: 'Leverage brackets of ETH/USDT',
      }),
    );
    expect(
      (screen.getByLabelText('Futures pair') as HTMLSelectElement).value,
    ).toBe('ETHUSDT');
    expect(
      (table.getByLabelText('To (USDT) of bracket 1') as HTMLInputElement)
        .value,
    ).toBe('25000');
    expect(
      (
        table.getByLabelText(
          'Maintenance margin (%) of bracket 2',
        ) as HTMLInputElement
      ).value,
    ).toBe('0.65');
    expect(table.getByText('25,000')).toBeTruthy();
    expect(screen.getByText(/Pair ceiling: 100x/)).toBeTruthy();
  });

  it('refuses a cap below its start before sending, then saves a new bracket', async () => {
    await open('/admin/leverage-brackets?pair=BTCUSDT');
    const user = userEvent.setup();
    const table = within(
      await screen.findByRole('region', {
        name: 'Leverage brackets of BTC/USDT',
      }),
    );
    const cap2 = table.getByLabelText('To (USDT) of bracket 2');
    await user.clear(cap2);
    await user.type(cap2, '40000');
    await user.click(screen.getByRole('button', { name: 'Save brackets' }));
    expect(table.getByText('Above the start of the bracket.')).toBeTruthy();
    await user.clear(cap2);
    await user.type(cap2, '600000');
    await user.click(screen.getByRole('button', { name: 'Add bracket' }));
    await user.type(table.getByLabelText('To (USDT) of bracket 4'), '5000000');
    const leverage4 = table.getByLabelText('Max leverage of bracket 4');
    await user.clear(leverage4);
    await user.type(leverage4, '50');
    await user.type(
      table.getByLabelText('Maintenance margin (%) of bracket 4'),
      '1',
    );
    await user.click(screen.getByRole('button', { name: 'Save brackets' }));
    expect(await screen.findByText('Brackets of BTC/USDT saved.')).toBeTruthy();
    // 950 + 3,000,000 × (1 % − 0.65 %) (BR-27), worked out by the server.
    expect(await screen.findByText('11,450.00')).toBeTruthy();
  });

  it('names the first bracket when it is below the pair ceiling (BR-26)', async () => {
    await open('/admin/leverage-brackets?pair=BTCUSDT');
    const user = userEvent.setup();
    const table = within(
      await screen.findByRole('region', {
        name: 'Leverage brackets of BTC/USDT',
      }),
    );
    const leverage1 = table.getByLabelText('Max leverage of bracket 1');
    await user.clear(leverage1);
    await user.type(leverage1, '110');
    await user.click(screen.getByRole('button', { name: 'Save brackets' }));
    expect(
      await table.findByText(
        'Below the pair ceiling; raise it or lower the ceiling first.',
      ),
    ).toBeTruthy();
  });
});
