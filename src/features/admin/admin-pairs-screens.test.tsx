// @vitest-environment jsdom
import { beforeAll, describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createDevelopmentAdminPairs } from '../../dev/dev-admin-pairs';
import { AdminPairsPage } from '../../pages/admin/AdminPairsPage';
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
    id: 'test-admin',
    email: 'admin@example.test',
    displayName: 'Test Admin',
    role: 'Admin',
    status: 'active',
  },
  entitlements: 'unknown',
};
const signedIn = fakeAuth({ restoreSession: async () => admin });

const open = () =>
  renderRoutes(
    [page('/admin/pairs', <AdminPairsPage />)],
    '/admin/pairs',
    signedIn,
    { adminPairs: createDevelopmentAdminPairs() },
  );

describe('SCR-37 pairs (UC-45)', () => {
  it('lists the pairs with their markets, searches and filters by status', async () => {
    await open();
    const table = within(
      await screen.findByRole('region', { name: 'Pairs in display order' }),
    );
    expect(await table.findByText('BTC/USDT')).toBeTruthy();
    // LINK is not on Futures: its Futures market says so.
    expect(table.getAllByText('Not listed').length).toBeGreaterThan(0);
    expect(
      table
        .getByRole('link', { name: 'Edit brackets of BTC/USDT' })
        .getAttribute('href'),
    ).toBe('/admin/leverage-brackets?pair=BTCUSDT');
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Search pairs'), 'eth');
    await waitFor(() => expect(table.queryByText('BTC/USDT')).toBeNull());
    expect(table.getByText('ETH/USDT')).toBeTruthy();
    await user.click(screen.getByRole('radio', { name: 'Inactive' }));
    expect(await table.findByText('No pair matches.')).toBeTruthy();
  });

  it('refuses Futures off while positions are open (MSG40) and saves a new ceiling', async () => {
    await open();
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole('button', { name: 'Edit ETH/USDT' }),
    );
    let dialog = within(screen.getByRole('dialog', { name: 'Edit ETH/USDT' }));
    await user.click(dialog.getByRole('switch', { name: /Futures market/ }));
    await user.click(dialog.getByRole('button', { name: 'Save' }));
    expect(
      await dialog.findByText(
        'ETH/USDT has open simulated positions and cannot be disabled.',
      ),
    ).toBeTruthy();
    await user.click(dialog.getByRole('button', { name: 'Cancel' }));

    await user.click(screen.getByRole('button', { name: 'Edit BTC/USDT' }));
    dialog = within(screen.getByRole('dialog', { name: 'Edit BTC/USDT' }));
    const leverage = dialog.getByLabelText('Max leverage');
    await user.clear(leverage);
    await user.type(leverage, '126');
    await user.click(dialog.getByRole('button', { name: 'Save' }));
    expect(
      dialog.getByText('Max leverage must be a whole number from 1 to 125.'),
    ).toBeTruthy();
    await user.clear(leverage);
    await user.type(leverage, '50');
    await user.click(dialog.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('BTC/USDT saved.')).toBeTruthy();
    expect(await screen.findByText('50x')).toBeTruthy();
  });

  it('says when the ceiling is above the first bracket (BR-26)', async () => {
    await open();
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole('button', { name: 'Edit ETH/USDT' }),
    );
    const dialog = within(
      screen.getByRole('dialog', { name: 'Edit ETH/USDT' }),
    );
    const leverage = dialog.getByLabelText('Max leverage');
    await user.clear(leverage);
    await user.type(leverage, '110');
    await user.click(dialog.getByRole('button', { name: 'Save' }));
    expect(
      await dialog.findByText(
        'Max leverage is above what the brackets allow (at most the first bracket’s leverage).',
      ),
    ).toBeTruthy();
  });

  it('adds a pair from the exchange symbols, inactive', async () => {
    await open();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Add pair' }));
    const dialog = within(screen.getByRole('dialog', { name: 'Add pair' }));
    await user.type(dialog.getByLabelText('Exchange symbol'), 'su');
    await user.click(
      await dialog.findByRole('button', { name: 'Add SUI/USDT' }),
    );
    expect(await screen.findByText('SUI/USDT added as inactive.')).toBeTruthy();
    const table = within(
      screen.getByRole('region', { name: 'Pairs in display order' }),
    );
    expect(await table.findByText('SUI/USDT')).toBeTruthy();
  });
});
