import { expect, test, type Page } from '@playwright/test';
import { ACCOUNTS, failOnPageErrors, open, signIn } from './support';

// Trading plan workflow: a Trader analyses a pair, plans a trade with the
// risk calculation and activates it (UC-15…UC-18; SCR-10, SCR-16, SCR-17,
// SCR-18; BR-22, BR-29, BR-32, MSG14, MSG18, MSG19, MSG27).

async function fillSpotPlan(
  page: Page,
  prices: { entry: string; stop: string; take: string },
) {
  await page.getByLabel('Entry price').fill(prices.entry);
  await page.getByLabel('Stop loss').fill(prices.stop);
  await page.getByLabel('Take profit').fill(prices.take);
}

const GOOD = { entry: '62000', stop: '60000', take: '66000' };

test.describe('Trading plan: analyse, plan, activate', () => {
  test(
    'UC-15 UC-16 · from the analysis a Trader creates a plan, sees its risk and activates it',
    { tag: ['@workflow', '@state', '@mobile'] },
    async ({ page }) => {
      const noErrors = failOnPageErrors(page);
      await signIn(page, ACCOUNTS.premium);
      await test.step('open the BTC/USDT Spot analysis (SCR-10)', async () => {
        await open(page, '/markets/spot/BTCUSDT');
        await expect(
          page.getByRole('heading', { name: /BTC\/USDT/ }).first(),
        ).toBeVisible();
      });
      await test.step('start a plan from the analysis (SCR-17)', async () => {
        await page.getByRole('link', { name: 'Create trading plan' }).click();
        await expect(page).toHaveURL(/\/plans\/new\?symbol=BTCUSDT/);
      });
      await test.step('enter entry, stop and take profit; the risk panel answers', async () => {
        await fillSpotPlan(page, GOOD);
        const panel = page.getByRole('region', { name: 'Risk calculation' });
        await expect(panel.getByText('Reward / risk')).toBeVisible();
      });
      await test.step('save and activate: MSG19, plan ACTIVE (DRAFT → ACTIVE)', async () => {
        await page.getByRole('button', { name: 'Save and activate' }).click();
        await expect(page.getByText('Trading plan activated.')).toBeVisible();
        await expect(page.getByText('Active').first()).toBeVisible();
      });
      await test.step('the plan is listed under Active (SCR-16)', async () => {
        await open(page, '/plans');
        await page.getByRole('tab', { name: 'Active' }).click();
        await expect(
          page.getByRole('table').getByText('BTC/USDT').first(),
        ).toBeVisible();
      });
      noErrors();
    },
  );

  test(
    'BR-32 · a draft is saved (MSG14), activated later, then cancelled',
    { tag: '@state' },
    async ({ page }) => {
      await signIn(page, ACCOUNTS.premium);
      await open(page, '/plans/new?symbol=BTCUSDT');
      await fillSpotPlan(page, GOOD);
      await test.step('save as draft: status DRAFT', async () => {
        await page.getByRole('button', { name: 'Save as draft' }).click();
        await expect(page.getByText('Saved successfully.')).toBeVisible();
      });
      await test.step('activate the draft: DRAFT → ACTIVE', async () => {
        await page.getByRole('button', { name: 'Activate' }).click();
        await expect(page.getByText('Trading plan activated.')).toBeVisible();
      });
      await test.step('cancel it: ACTIVE → CANCELLED', async () => {
        await page.getByRole('button', { name: 'Cancel plan' }).click();
        await page
          .getByRole('dialog')
          .getByRole('button', { name: 'Cancel plan' })
          .click();
        await expect(page.getByText('Cancelled').first()).toBeVisible();
      });
      await test.step('a cancelled plan offers no further move', async () => {
        await expect(
          page.getByRole('button', { name: 'Activate' }),
        ).toHaveCount(0);
        await expect(
          page.getByRole('button', { name: 'Cancel plan' }),
        ).toHaveCount(0);
        await expect(page.getByRole('link', { name: 'Edit' })).toHaveCount(0);
      });
    },
  );

  test(
    'BR-32 · a plan that is not a draft cannot be edited',
    { tag: ['@state', '@exception'] },
    async ({ page }) => {
      await signIn(page, ACCOUNTS.premium);
      await open(page, '/plans');
      await page.getByRole('tab', { name: 'Active' }).click();
      await page
        .getByRole('link', { name: /Open plan/ })
        .first()
        .click();
      await page.waitForURL(/\/plans\/[0-9a-f-]{36}$/);
      await open(page, new URL(page.url()).pathname + '/edit');
      await expect(
        page.getByText(/Only draft plans can be edited\. This plan is/),
      ).toBeVisible();
    },
  );

  test(
    'BR-22 MSG16 · a long stop loss above the entry is refused under its field',
    { tag: '@exception' },
    async ({ page }) => {
      await signIn(page, ACCOUNTS.premium);
      await open(page, '/plans/new?symbol=BTCUSDT');
      await fillSpotPlan(page, {
        entry: '62000',
        stop: '63000',
        take: '66000',
      });
      await expect(page.getByText(/For LONG positions/i).first()).toBeVisible();
      await page.getByRole('button', { name: 'Save and activate' }).click();
      await expect(page).toHaveURL(/\/plans\/new/);
    },
  );

  test(
    'MSG27 · a Free Trader cannot activate more plans than the plan allows',
    { tag: ['@exception', '@rbac'] },
    async ({ page }) => {
      await signIn(page, ACCOUNTS.free);
      await test.step('the third active plan is accepted', async () => {
        await open(page, '/plans/new?symbol=BTCUSDT');
        await fillSpotPlan(page, GOOD);
        await page.getByRole('button', { name: 'Save and activate' }).click();
        await expect(page.getByText('Trading plan activated.')).toBeVisible();
      });
      await test.step('the fourth is refused with MSG27 and nothing is saved', async () => {
        await open(page, '/plans/new?symbol=BTCUSDT');
        await fillSpotPlan(page, GOOD);
        await page.getByRole('button', { name: 'Save and activate' }).click();
        await expect(page.getByText(/limit|upgrade/i).first()).toBeVisible();
        await expect(page).toHaveURL(/\/plans\/new/);
      });
    },
  );
});
