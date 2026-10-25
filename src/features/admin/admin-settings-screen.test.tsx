// @vitest-environment jsdom
import { beforeAll, describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createDevelopmentAdminSettings } from '../../dev/dev-admin-settings';
import { AdminSettingsPage } from '../../pages/admin/AdminSettingsPage';
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
    [page('/admin/settings', <AdminSettingsPage />)],
    '/admin/settings',
    signedIn,
    { adminSettings: createDevelopmentAdminSettings() },
  );

const field = (key: string) =>
  screen.getByLabelText(`Value of ${key}`) as HTMLInputElement;

describe('SCR-43 system settings (UC-51)', () => {
  it('shows the settings by group with their range and the fee as a percent', async () => {
    await open();
    expect(await screen.findByText('Fees and slippage')).toBeTruthy();
    expect(screen.getByText('Plan warnings and entry deviation')).toBeTruthy();
    expect(screen.getByText('Upload limits')).toBeTruthy();
    expect(field('SPOT_TAKER_FEE').value).toBe('0.001');
    expect(screen.getAllByText('From 0 to 0.1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('= 0.1 %').length).toBe(2);
    expect(screen.queryByRole('button', { name: 'Review and save' })).toBe(
      null,
    );
  });

  it('refuses a value out of range or across BR-69 before sending', async () => {
    await open();
    const user = userEvent.setup();
    const fee = await screen.findByLabelText('Value of SPOT_TAKER_FEE');
    await user.clear(fee);
    await user.type(fee, '0.2');
    await user.click(screen.getByRole('button', { name: 'Review and save' }));
    expect(screen.getByText('Value must be between 0 and 0.1.')).toBeTruthy();
    await user.clear(fee);
    await user.type(fee, '0.001');
    expect(screen.queryByText('1 unsaved change')).toBe(null);

    const confirm = field('ENTRY_DEVIATION_CONFIRM_R');
    await user.clear(confirm);
    await user.type(confirm, '0.9');
    await user.click(screen.getByRole('button', { name: 'Review and save' }));
    expect(
      screen.getByText('At most ENTRY_DEVIATION_BLOCK_R (0.75).'),
    ).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBe(null);
  });

  it('lists the changes old → new, saves them in turn and says MSG14', async () => {
    await open();
    const user = userEvent.setup();
    const block = await screen.findByLabelText(
      'Value of ENTRY_DEVIATION_BLOCK_R',
    );
    await user.clear(block);
    await user.type(block, '1.2');
    const confirm = field('ENTRY_DEVIATION_CONFIRM_R');
    await user.clear(confirm);
    await user.type(confirm, '0.9');
    const images = field('MAX_IMAGES_PER_POST');
    await user.clear(images);
    await user.type(images, '6');
    expect(screen.getByText('3 unsaved changes')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Review and save' }));

    const dialog = within(
      screen.getByRole('dialog', { name: 'Save these settings?' }),
    );
    const rows = dialog.getAllByRole('row').slice(1);
    expect(rows.map((row) => row.textContent)).toEqual([
      'ENTRY_DEVIATION_CONFIRM_R0.250.9',
      'ENTRY_DEVIATION_BLOCK_R0.751.2',
      'MAX_IMAGES_PER_POST46',
    ]);
    await user.click(dialog.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Saved successfully.')).toBeTruthy();
    expect((await screen.findAllByText(/^Changed /)).length).toBe(3);
    expect(field('ENTRY_DEVIATION_CONFIRM_R').value).toBe('0.9');
    expect(screen.queryByText(/unsaved change/)).toBe(null);
  });

  it('marks a value the server refuses and keeps the others saved', async () => {
    await open();
    const user = userEvent.setup();
    const fee = await screen.findByLabelText('Value of SPOT_MAKER_FEE');
    await user.clear(fee);
    await user.type(fee, '0.000123456');
    const images = field('MAX_IMAGES_PER_POST');
    await user.clear(images);
    await user.type(images, '7');
    await user.click(screen.getByRole('button', { name: 'Review and save' }));
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Save changes',
      }),
    );
    expect(
      await screen.findByText('1 of 2 saved. The others are marked below.'),
    ).toBeTruthy();
    expect(
      screen.getByText(
        'Refused: out of range, too many decimal places, or across a related setting.',
      ),
    ).toBeTruthy();
    expect(field('SPOT_MAKER_FEE').value).toBe('0.000123456');
    expect(screen.getByText('1 unsaved change')).toBeTruthy();
  });

  it('discards the changes', async () => {
    await open();
    const user = userEvent.setup();
    const images = await screen.findByLabelText('Value of MAX_IMAGES_PER_POST');
    await user.clear(images);
    await user.type(images, '9');
    await user.click(screen.getByRole('button', { name: 'Discard' }));
    expect(field('MAX_IMAGES_PER_POST').value).toBe('4');
  });
});
