import { expect, test } from '@playwright/test';
import {
  ACCOUNTS,
  failOnPageErrors,
  open,
  overflowsHorizontally,
  signIn,
} from './support';

test.describe('performance and journal (SCR-23, SCR-20)', () => {
  test('FREE sees its figures and the locks @mobile', async ({ page }) => {
    const noErrors = failOnPageErrors(page);
    await signIn(page, ACCOUNTS.free);
    await open(page, '/performance');
    await expect(page.getByText('Total net P/L')).toBeVisible();
    await expect(page.getByRole('link', { name: 'View plans' })).toHaveCount(3);
    expect(await overflowsHorizontally(page)).toBe(false);
    noErrors();
  });

  test('PRO sees the curve and the breakdowns @mobile', async ({ page }) => {
    const noErrors = failOnPageErrors(page);
    await signIn(page, ACCOUNTS.pro);
    await open(page, '/performance');
    await expect(page.getByText('Equity curve')).toBeVisible();
    await expect(page.getByRole('region', { name: 'By coin' })).toBeVisible();
    await expect(page.getByText('Unassigned').first()).toBeVisible();
    expect(await overflowsHorizontally(page)).toBe(false);
    noErrors();
  });

  test('a filter stays in the address', async ({ page }) => {
    await signIn(page, ACCOUNTS.pro);
    await open(page, '/performance');
    await page.getByRole('radio', { name: '30D' }).click();
    await expect(page).toHaveURL(/period=30d/);
  });

  test('the journal opens a trade and links the dashboard @mobile', async ({
    page,
  }) => {
    const noErrors = failOnPageErrors(page);
    await signIn(page, ACCOUNTS.pro);
    await open(page, '/journal?market=futures');
    await page
      .getByRole('button', { name: /^Open the / })
      .first()
      .click();
    await expect(page.getByRole('dialog')).toContainText('Net P/L');
    await page.keyboard.press('Escape');
    expect(await overflowsHorizontally(page)).toBe(false);
    await page.getByRole('link', { name: 'Performance' }).last().click();
    await expect(page).toHaveURL(/\/performance\?market=futures/);
    noErrors();
  });
});
