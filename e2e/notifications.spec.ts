import { expect, test } from '@playwright/test';
import {
  ACCOUNTS,
  failOnPageErrors,
  open,
  overflowsHorizontally,
  signIn,
} from './support';

// Notification center: the bell's unread count, opening a notification
// marks it read and follows its reference, mark all as read (UC-15;
// SCR-15, SCR-08; SRS 3.4.5).

test.describe('Notifications: the bell and the notification center', () => {
  test(
    'UC-15 · a Trader opens a notification from the bell and reads all on SCR-15',
    { tag: ['@workflow', '@mobile'] },
    async ({ page }) => {
      const noErrors = failOnPageErrors(page);
      await signIn(page, ACCOUNTS.pro);
      await test.step('the bell shows three unread', async () => {
        await expect(
          page.getByRole('button', { name: 'Notifications, 3 unread' }),
        ).toBeVisible();
      });
      await test.step('opening the plan notification marks it read and opens the plan', async () => {
        await page
          .getByRole('button', { name: 'Notifications, 3 unread' })
          .click();
        await page
          .getByRole('dialog', { name: 'Notifications' })
          .getByRole('button', { name: /Trading plan executed/ })
          .click();
        await page.waitForURL((url) => url.pathname.startsWith('/plans/'));
        await expect(
          page.getByRole('button', { name: 'Notifications, 2 unread' }),
        ).toBeVisible();
      });
      await test.step('the Unread tab lists two; Mark all as read empties it', async () => {
        await open(page, '/notifications');
        await page.getByRole('tab', { name: /Unread/ }).click();
        await expect(page.getByText('Unread', { exact: true })).toHaveCount(2);
        expect(await overflowsHorizontally(page)).toBe(false);
        await page.getByRole('button', { name: 'Mark all as read' }).click();
        await expect(page.getByText('You are all caught up.')).toBeVisible();
        await expect(
          page.getByRole('button', { name: 'Notifications', exact: true }),
        ).toBeVisible();
      });
      noErrors();
    },
  );
});
