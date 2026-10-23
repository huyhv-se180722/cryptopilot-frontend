import { expect, test } from '@playwright/test';
import {
  ACCOUNTS,
  failOnPageErrors,
  open,
  overflowsHorizontally,
  signIn,
} from './support';

// Report moderation: an Admin reviews a reported post and decides once
// for all its reports (UC-43; SCR-36; SRS 3.11.3; BR-57).

test.describe('Moderation: review reported posts', () => {
  test(
    'UC-43 · an Admin hides one reported post and removes another',
    { tag: ['@workflow', '@mobile'] },
    async ({ page }) => {
      const noErrors = failOnPageErrors(page);
      await signIn(page, ACCOUNTS.admin);
      await open(page, '/admin/reports');
      await test.step('the queue lists three posts', async () => {
        await expect(page.getByText('To review: 3')).toBeVisible();
        expect(await overflowsHorizontally(page)).toBe(false);
      });
      await test.step('review the post with two reports and hide it', async () => {
        await page
          .getByRole('button', { name: /Review "A short walk/ })
          .click();
        const dialog = page.getByRole('dialog', {
          name: 'Review reported post',
        });
        await expect(dialog.getByText('Reports (2)')).toBeVisible();
        await expect(
          dialog.getByText(
            'Links to a paid signal group in the video description.',
          ),
        ).toBeVisible();
        await dialog.getByLabel('Note for the audit log').fill('Paid signals');
        await dialog.getByRole('button', { name: /Hide post/ }).click();
        await expect(page.getByText('Post hidden.')).toBeVisible();
        await expect(page.getByText('To review: 2')).toBeVisible();
      });
      await test.step('removing a post asks first', async () => {
        await page
          .getByRole('button', { name: /Review "How I size positions/ })
          .click();
        await page.getByRole('button', { name: /Remove post/ }).click();
        const confirm = page.getByRole('dialog', { name: 'Remove this post?' });
        await expect(confirm).toBeVisible();
        await confirm.getByRole('button', { name: 'Remove post' }).click();
        await expect(page.getByText('Post removed.')).toBeVisible();
        await expect(page.getByText('To review: 1')).toBeVisible();
      });
      noErrors();
    },
  );
});
