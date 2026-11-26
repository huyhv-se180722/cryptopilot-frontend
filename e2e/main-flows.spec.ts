import { expect, test } from '@playwright/test';
import { ACCOUNTS, failOnPageErrors, open, signIn } from './support';

/**
 * T-093: the end of the plan flow and the purchase flow of TECHNICAL_DESIGN
 * 11.1, on the development fixtures. The first part of the plan flow (create,
 * see the risk, activate) is trading-plan.spec.ts; register, verify and sign
 * in is account.spec.ts.
 */

// The fixture's BTC/USDT Spot plan that has filled and holds an open position.
const FILLED_PLAN = '0199a2c4-0000-7000-8000-000000000011';

test.describe('Main flows (T-093)', () => {
  test(
    'UC-20 UC-21 · a filled plan is closed at market and its trade is in the journal',
    { tag: ['@workflow', '@state'] },
    async ({ page }) => {
      const noErrors = failOnPageErrors(page);
      await signIn(page, ACCOUNTS.pro);

      await test.step('open the filled plan: its position is open (SCR-18)', async () => {
        await open(page, `/plans/${FILLED_PLAN}`);
        await expect(
          page.getByRole('button', { name: 'Close position' }).first(),
        ).toBeVisible();
      });

      await test.step('close at market from the estimate (T-046)', async () => {
        await page
          .getByRole('button', { name: 'Close position' })
          .first()
          .click();
        const dialog = page.getByRole('dialog', { name: 'Close position' });
        await expect(
          dialog.getByText('Estimated net P/L (USDT)'),
        ).toBeVisible();
        await dialog.getByRole('button', { name: 'Close at market' }).click();
        await expect(page.getByText(/Position closed\./).first()).toBeVisible();
        await expect(
          page.getByRole('button', { name: 'Close position' }),
        ).toHaveCount(0);
      });

      await test.step('the journal lists the trade of the plan, simulated and closed (T-048a)', async () => {
        await open(page, '/journal');
        // Filled at 61,500, closed at the estimate's 62,050 (fixture).
        const row = page
          .getByRole('table', { name: 'Your trades' })
          .getByRole('row')
          .filter({ hasText: 'BTC/USDT' })
          .filter({ hasText: '61,500.00' })
          .filter({ hasText: '62,050.00' });
        await expect(row).toContainText('Simulated');
        await expect(row).toContainText('Closed');
      });
      noErrors();
    },
  );

  test(
    'UC-42 · a Free Trader buys Pro through the sandbox gateway and the payment is confirmed',
    { tag: ['@workflow', '@state'] },
    async ({ page }) => {
      const noErrors = failOnPageErrors(page);
      // The sandbox gateway: the browser is sent there with the order code. The
      // navigation is cancelled (as a press of Stop), so the app's page and its
      // in-memory session stay loaded; the test then plays the gateway's return.
      let orderCode: string | null = null;
      await page.route('https://sandbox.gateway.invalid/**', async (route) => {
        orderCode = new URL(route.request().url()).searchParams.get(
          'orderCode',
        );
        await route.abort('aborted');
      });
      await signIn(page, ACCOUNTS.free);

      await test.step('choose Pro on the plans screen (SCR-31)', async () => {
        await open(page, '/subscription');
        await expect(page.getByText('You are on the Free plan.')).toBeVisible();
        await page
          .getByLabel('Pro (monthly)', { exact: true })
          .getByRole('button', { name: 'Choose' })
          .click();
      });

      await test.step('confirm the quote and pay by bank transfer', async () => {
        const dialog = page.getByRole('dialog', {
          name: 'Confirm Pro (monthly)',
        });
        await expect(
          dialog.getByText('199,000 ₫', { exact: true }),
        ).toBeVisible();
        await expect(dialog.getByText(/\(30 days\)/)).toBeVisible();
        await dialog.getByRole('radio', { name: 'Bank transfer / QR' }).check();
        await dialog.getByRole('button', { name: 'Pay 199,000 ₫' }).click();
        await expect.poll(() => orderCode).not.toBeNull();
      });

      await test.step('back from the gateway: pending, then confirmed', async () => {
        await open(page, `/subscription/payment-result?orderCode=${orderCode}`);
        await expect(page.getByText(`Order ${orderCode}`)).toBeVisible();
        await expect(page.getByText('Payment confirmed')).toBeVisible({
          timeout: 20_000,
        });
        await expect(
          page.getByText(/Pro \(monthly\) is active until/),
        ).toBeVisible();
      });
      noErrors();
    },
  );
});
