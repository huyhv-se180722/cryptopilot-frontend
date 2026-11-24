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
    // One breakdown at a time: trades without a strategy are "Unassigned".
    await page.getByRole('radio', { name: 'By strategy' }).click();
    await expect(
      page.getByRole('region', { name: 'By strategy' }).getByText('Unassigned'),
    ).toBeVisible();
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
    // A trade opens on its own screen (SCR-21) and the way back keeps the filter.
    await page
      .getByRole('link', { name: /^Open the / })
      .first()
      .click();
    await expect(page).toHaveURL(/\/journal\/[0-9a-f-]+$/);
    await expect(page.getByText('Net P/L').first()).toBeVisible();
    expect(await overflowsHorizontally(page)).toBe(false);
    await page.goBack();
    await expect(page).toHaveURL(/\/journal\?market=futures$/);
    await page.getByRole('link', { name: 'Performance' }).last().click();
    await expect(page).toHaveURL(/\/performance\?market=futures/);
    noErrors();
  });
});
