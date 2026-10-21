import { expect, test } from '@playwright/test';
import { ACCOUNTS, failOnPageErrors, open, signIn } from './support';

// Watchlist and alert workflow: a Trader follows a pair and sets a price
// alert on it, then manages the alert (UC-12, UC-13, UC-14; SCR-12,
// SCR-13, SCR-14; BR-16, MSG26, MSG27).

test.describe('Watchlist and alerts: follow a pair, alert on it', () => {
  test(
    'UC-12 UC-13 · a Trader adds a pair to the watchlist and creates a price alert on it',
    { tag: ['@workflow', '@mobile'] },
    async ({ page }) => {
      const noErrors = failOnPageErrors(page);
      await signIn(page, ACCOUNTS.pro);
      await test.step('add BNB/USDT from the Add pair dialog (SCR-12)', async () => {
        await open(page, '/watchlist');
        await page.getByRole('button', { name: 'Add pair' }).first().click();
        await page
          .getByRole('dialog')
          .getByRole('button', { name: 'Add BNB/USDT' })
          .click();
        await expect(
          page.getByText('BNB/USDT added to your watchlist.'),
        ).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(
          page.getByRole('link', { name: 'BNB/USDT' }),
        ).toBeVisible();
      });
      await test.step('create a price alert for it (SCR-14)', async () => {
        await page
          .getByRole('button', { name: 'Create alert for BNB/USDT' })
          .click();
        // Opened from its row, the dialog is fixed to that pair: it names
        // the pair and offers no pair choice (FEQ-01).
        const dialog = page.getByRole('dialog');
        await expect(
          dialog.getByText('BNB/USDT', { exact: true }),
        ).toBeVisible();
        await expect(
          dialog.getByRole('combobox', { name: 'Pair' }),
        ).toHaveCount(0);
        await dialog
          .getByRole('combobox', { name: 'Condition' })
          .selectOption({ label: 'Crosses above' });
        await dialog
          .getByRole('textbox', { name: 'Target price (USDT)' })
          .fill('700');
        await dialog.getByRole('button', { name: 'Save alert' }).click();
        await expect(dialog).toBeHidden();
      });
      await test.step('the alert is listed as Active (SCR-13)', async () => {
        await open(page, '/alerts');
        const row = page.getByRole('row', {
          name: /BNB\/USDT.*Crosses above 700/,
        });
        await expect(row).toBeVisible();
        await expect(
          row.getByRole('cell', { name: 'Active', exact: true }),
        ).toBeVisible();
      });
      noErrors();
    },
  );

  test(
    'SCR-13 · an alert is paused, resumed and deleted (ACTIVE ⇄ PAUSED)',
    { tag: '@state' },
    async ({ page }) => {
      await signIn(page, ACCOUNTS.pro);
      await open(page, '/alerts');
      const row = page.getByRole('row', {
        name: /BTC\/USDT.*Crosses above 65,000/,
      });
      const act = async (name: string) => {
        await row.getByRole('button', { name: /Actions for/ }).click();
        await page.getByRole('menuitem', { name }).click();
      };
      await test.step('pause: ACTIVE → PAUSED', async () => {
        await act('Pause');
        await expect(page.getByText('Alert paused.')).toBeVisible();
        await expect(
          row.getByRole('cell', { name: 'Paused', exact: true }),
        ).toBeVisible();
      });
      await test.step('resume: PAUSED → ACTIVE', async () => {
        await act('Resume');
        await expect(page.getByText('Alert resumed.')).toBeVisible();
        await expect(
          row.getByRole('cell', { name: 'Active', exact: true }),
        ).toBeVisible();
      });
      await test.step('delete after confirming', async () => {
        await act('Delete');
        await page
          .getByRole('dialog')
          .getByRole('button', { name: 'Delete' })
          .click();
        await expect(page.getByText('Alert deleted.')).toBeVisible();
        await expect(row).toHaveCount(0);
      });
    },
  );

  test(
    'BR-16 MSG26 · removing a watched pair asks first, naming its alerts',
    { tag: '@exception' },
    async ({ page }) => {
      await signIn(page, ACCOUNTS.pro);
      await open(page, '/watchlist');
      await page.getByRole('button', { name: 'Actions for BTC/USDT' }).click();
      await page
        .getByRole('menuitem', { name: 'Remove from watchlist' })
        .click();
      const dialog = page.getByRole('dialog');
      await expect(
        dialog.getByText(
          'Removing BTC/USDT will also delete 2 alerts. Continue?',
        ),
      ).toBeVisible();
      await dialog.getByRole('button', { name: 'Remove' }).click();
      await expect(
        page.getByText('BTC/USDT removed from watchlist.'),
      ).toBeVisible();
      await open(page, '/alerts');
      await expect(page.getByRole('row', { name: /^BTC\/USDT/ })).toHaveCount(
        0,
      );
    },
  );

  test(
    'BR-15 BR-62 · a Free Trader at the watchlist limit cannot add a pair',
    { tag: ['@exception', '@rbac'] },
    async ({ page }) => {
      await signIn(page, ACCOUNTS.free);
      await open(page, '/watchlist');
      await expect(
        page.getByText('5 / 5 pairs', { exact: true }),
      ).toBeVisible();
      await page.getByRole('button', { name: 'Add pair' }).first().click();
      const dialog = page.getByRole('dialog');
      await expect(
        dialog.getByRole('button', { name: 'Add BNB/USDT' }),
      ).toBeDisabled();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('link', { name: 'BNB/USDT' })).toHaveCount(0);
    },
  );

  test(
    'UC-12 MSG27 · the watchlist limit is explained with MSG27',
    { tag: ['@exception', '@rbac'] },
    async ({ page }) => {
      await signIn(page, ACCOUNTS.free);
      await open(page, '/watchlist');
      await page.getByRole('button', { name: 'Add pair' }).first().click();
      const dialog = page.getByRole('dialog');
      await expect(
        dialog.getByText(
          /You have reached the limit of 5 .+ plan\. Upgrade to increase the limit\?/,
        ),
      ).toBeVisible();
      await dialog.getByRole('link', { name: 'View plans' }).click();
      await expect(page).toHaveURL(/\/subscription$/);
    },
  );
});
