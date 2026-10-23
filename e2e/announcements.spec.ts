import { expect, test } from '@playwright/test';
import {
  ACCOUNTS,
  failOnPageErrors,
  open,
  overflowsHorizontally,
  signIn,
} from './support';

// Official announcements: an Admin publishes, edits and deletes a pinned
// post of the community (UC-44; SRS 3.7.2; BR-47, BR-61; MSG33, MSG14).

test.describe('Announcements: publish official posts', () => {
  test(
    'UC-44 · an Admin publishes a platform update, edits its category and deletes it',
    { tag: ['@workflow', '@mobile'] },
    async ({ page }) => {
      const noErrors = failOnPageErrors(page);
      const title = 'Scheduled maintenance tonight';
      await signIn(page, ACCOUNTS.admin);
      await open(page, '/admin/announcements');
      await test.step('the list shows the seeded announcements', async () => {
        await expect(
          page.getByRole('heading', { name: 'Announcements' }),
        ).toBeVisible();
        await expect(page.getByRole('table')).toBeVisible();
        expect(await overflowsHorizontally(page)).toBe(false);
      });
      await test.step('publish a platform update (MSG33)', async () => {
        await page.getByRole('link', { name: 'New announcement' }).click();
        await page
          .getByRole('combobox', { name: 'Category' })
          .selectOption('PLATFORM_UPDATE');
        await page.getByLabel('Title').fill(title);
        await page
          .getByLabel('Content')
          .fill('Trading screens pause from 23:00 to 23:30.');
        await page.getByRole('button', { name: 'Publish' }).click();
        await expect(
          page.getByText('Your post has been published.'),
        ).toBeVisible();
        await expect(page.getByText(title)).toBeVisible();
      });
      await test.step('move it to Education (MSG14)', async () => {
        await page.getByRole('link', { name: `Edit "${title}"` }).click();
        await page
          .getByRole('combobox', { name: 'Category' })
          .selectOption('EDUCATION');
        await page.getByRole('button', { name: 'Save changes' }).click();
        await expect(page.getByText('Saved successfully.')).toBeVisible();
        await page.getByRole('radio', { name: 'Education' }).click();
        await expect(page.getByText(title)).toBeVisible();
      });
      await test.step('delete it after the confirmation (BR-47)', async () => {
        await page.getByRole('button', { name: `Delete "${title}"` }).click();
        await page
          .getByRole('dialog', { name: 'Delete this announcement?' })
          .getByRole('button', { name: 'Delete' })
          .click();
        await expect(page.getByText('Announcement deleted.')).toBeVisible();
        await expect(page.getByText(title)).toHaveCount(0);
      });
      noErrors();
    },
  );
});
