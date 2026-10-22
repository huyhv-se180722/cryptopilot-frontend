import { expect, test } from '@playwright/test';
import {
  ACCOUNTS,
  failOnPageErrors,
  open,
  overflowsHorizontally,
  signIn,
} from './support';

// Community workflow: a Guest reads the forum (D-99), a Trader publishes,
// comments, replies and reports (UC-26, UC-27, UC-29, UC-30, UC-31,
// UC-33; SCR-24…27; BR-45, BR-46, BR-47, MSG33, MSG34).

test.describe('Community: read, publish, discuss, report', () => {
  test(
    'UC-26 · a Guest reads the feed and a post and is asked to sign in to react',
    { tag: ['@workflow', '@mobile'] },
    async ({ page }) => {
      const noErrors = failOnPageErrors(page);
      await page.goto('/community');
      await test.step('the feed lists the pinned announcements first (BR-61)', async () => {
        const first = page.getByRole('article').first();
        await expect(first.getByText('Pinned')).toBeVisible();
        await expect(page.getByRole('tab', { name: 'Saved' })).toHaveCount(0);
        expect(await overflowsHorizontally(page)).toBe(false);
      });
      await test.step('a like asks the Guest to sign in', async () => {
        await page.getByRole('button', { name: 'Like' }).first().click();
        await expect(
          page.getByRole('dialog', { name: 'Sign in to join the discussion' }),
        ).toBeVisible();
        await page.keyboard.press('Escape');
      });
      await test.step('the post shows its threads and a deleted comment', async () => {
        await page
          .getByRole('link', { name: 'BTC is back at the weekly support' })
          .click();
        await expect(
          page.getByRole('heading', { level: 1, name: /BTC is back/ }),
        ).toBeVisible();
        await expect(
          page.getByText('Comment deleted', { exact: true }),
        ).toBeVisible();
        await expect(
          page.getByText('Replying to a comment that was deleted later.'),
        ).toBeVisible();
      });
      noErrors();
    },
  );

  test(
    'UC-27 UC-30 UC-29 · a Trader publishes a post, replies on it and deletes it',
    { tag: ['@workflow'] },
    async ({ page }) => {
      const noErrors = failOnPageErrors(page);
      await signIn(page, ACCOUNTS.free);
      await open(page, '/community/new');
      await test.step('the form checks the lengths first', async () => {
        await page.getByRole('button', { name: 'Publish' }).click();
        await expect(
          page.getByText('The title has 5 to 150 characters.'),
        ).toBeVisible();
      });
      await test.step('publish with a coin tag (MSG33)', async () => {
        await page.getByLabel('Title').fill('Watching ETH into the weekend');
        await page.getByLabel('Content').fill('Range is tight; waiting.');
        const coin = page.getByLabel('Coin tags');
        await coin.fill('eth');
        await coin.press('Enter');
        await page.getByRole('button', { name: 'Publish' }).click();
        await expect(
          page.getByText('Your post has been published.'),
        ).toBeVisible();
        await expect(
          page.getByRole('heading', {
            level: 1,
            name: 'Watching ETH into the weekend',
          }),
        ).toBeVisible();
        await expect(page.getByRole('link', { name: '$ETH' })).toBeVisible();
      });
      await test.step('comment, then reply to the comment', async () => {
        await page.getByLabel('Comment text').fill('First thought.');
        await page
          .getByRole('button', { name: 'Comment', exact: true })
          .click();
        await expect(page.getByText('First thought.')).toBeVisible();
        await page.getByRole('button', { name: 'Reply' }).first().click();
        await page.getByLabel('Comment text').fill('And a follow-up.');
        await page
          .getByRole('button', { name: 'Reply', exact: true })
          .last()
          .click();
        await expect(page.getByText('And a follow-up.')).toBeVisible();
      });
      await test.step('delete the post (BR-47)', async () => {
        await page.getByRole('button', { name: 'Post actions' }).click();
        await page.getByRole('menuitem', { name: 'Delete' }).click();
        await page
          .getByRole('dialog', { name: 'Delete this post?' })
          .getByRole('button', { name: 'Delete' })
          .click();
        await expect(page.getByText('Post deleted.')).toBeVisible();
        await page.waitForURL((url) => url.pathname === '/community');
        await expect(
          page.getByRole('link', { name: 'Watching ETH into the weekend' }),
        ).toHaveCount(0);
      });
      noErrors();
    },
  );

  test(
    'UC-33 · a Trader reports a post once (BR-46, MSG34)',
    { tag: ['@workflow', '@mobile'] },
    async ({ page }) => {
      const noErrors = failOnPageErrors(page);
      await signIn(page, ACCOUNTS.pro);
      const report = async (path: string) => {
        await open(page, path);
        await page.getByRole('button', { name: 'Post actions' }).click();
        await page.getByRole('menuitem', { name: 'Report' }).click();
        const dialog = page.getByRole('dialog', { name: 'Report post' });
        await dialog.getByLabel('Spam').check();
        await dialog.getByRole('button', { name: 'Submit report' }).click();
        return dialog;
      };
      await test.step('a first report is submitted', async () => {
        const dialog = await report('/community/dev-post-2');
        await expect(dialog).toBeHidden();
        await expect(
          page.getByText('Thank you, your report has been submitted.'),
        ).toBeVisible();
      });
      await test.step('a second report says it was already reported', async () => {
        const dialog = await report('/community/dev-post-2');
        await expect(
          dialog.getByText('You have already reported this post.'),
        ).toBeVisible();
      });
      noErrors();
    },
  );

  test(
    'CF-01b · the Spot analysis shows the coin discussion and opens a post tagged with it',
    { tag: ['@workflow', '@mobile'] },
    async ({ page }) => {
      const noErrors = failOnPageErrors(page);
      await signIn(page, ACCOUNTS.free);
      await open(page, '/markets/spot/BTCUSDT');
      const card = page.getByRole('region', { name: '$BTC discussion' });
      await expect(card.getByText('All posts')).toBeVisible();
      await card.getByRole('link', { name: 'Post about BTC' }).click();
      await page.waitForURL((url) => url.pathname === '/community/new');
      await expect(
        page.getByRole('button', { name: 'Remove BTC' }),
      ).toBeVisible();
      noErrors();
    },
  );
});
