import { expect, test } from '@playwright/test';
import {
  ACCOUNTS,
  DEV_PASSWORD,
  failOnPageErrors,
  open,
  signIn,
} from './support';

// Account workflow: a Guest registers, verifies the email and signs in
// (UC-01, UC-02, UC-03; SCR-02, SCR-03, SCR-04; BR-01, BR-02, BR-03).

test.describe('Account: register, verify, sign in', () => {
  test(
    'UC-01 UC-02 UC-03 · a Guest registers, verifies the email and signs in',
    { tag: ['@workflow', '@mobile'] },
    async ({ page }) => {
      const noErrors = failOnPageErrors(page);
      await test.step('open SCR-02 and fill the form', async () => {
        await page.goto('/register');
        await page.getByLabel('Display name').fill('E2E Trader');
        await page.getByLabel('Email address').fill('e2e.new@dev.local');
        await page.getByLabel('Password', { exact: true }).fill('Valid-Pass1');
        await page.getByLabel('Confirm password').fill('Valid-Pass1');
        await page.getByRole('checkbox').check();
      });
      await test.step('create the account: MSG05, check the mailbox', async () => {
        await page.getByRole('button', { name: 'Create free account' }).click();
        await expect(
          page.getByRole('heading', { name: 'Check your mailbox' }),
        ).toBeVisible();
      });
      await test.step('open the verification link: MSG06', async () => {
        await page.goto('/verify-email?token=dev-valid');
        await expect(
          page.getByRole('heading', { name: 'Email verified' }),
        ).toBeVisible();
      });
      await test.step('sign in and reach the dashboard', async () => {
        await signIn(page, ACCOUNTS.pro);
        await expect(page).toHaveURL(/\/dashboard$/);
      });
      await test.step('sign out returns to the public site', async () => {
        await page
          .getByRole('button', { name: /account|profile|menu/i })
          .last()
          .click();
        await page.getByRole('menuitem', { name: 'Sign out' }).click();
        await expect(page).toHaveURL(/\/$/);
        await expect(
          page.getByRole('link', { name: 'Get Started Free' }),
        ).toBeVisible();
      });
      noErrors();
    },
  );

  test(
    'BR-02 · a password breaking the policy is refused under its field',
    { tag: '@exception' },
    async ({ page }) => {
      await page.goto('/register');
      await page.getByLabel('Display name').fill('E2E Trader');
      await page.getByLabel('Email address').fill('e2e.weak@dev.local');
      await page.getByLabel('Password', { exact: true }).fill('short');
      await page.getByLabel('Confirm password').fill('short');
      await page.getByRole('checkbox').check();
      await page.getByRole('button', { name: 'Create free account' }).click();
      await expect(page).toHaveURL(/\/register$/);
      await expect(
        page.getByRole('heading', { name: 'Check your mailbox' }),
      ).toHaveCount(0);
    },
  );

  test(
    'MSG04 · an email already registered is refused',
    { tag: '@exception' },
    async ({ page }) => {
      await page.goto('/register');
      await page.getByLabel('Display name').fill('E2E Trader');
      await page.getByLabel('Email address').fill(ACCOUNTS.pro);
      await page.getByLabel('Password', { exact: true }).fill('Valid-Pass1');
      await page.getByLabel('Confirm password').fill('Valid-Pass1');
      await page.getByRole('checkbox').check();
      await page.getByRole('button', { name: 'Create free account' }).click();
      await expect(page.getByText(/already/i).first()).toBeVisible();
    },
  );

  test(
    'MSG07 · an invalid or expired verification link is refused',
    { tag: '@exception' },
    async ({ page }) => {
      await page.goto('/verify-email?token=not-a-token');
      await expect(
        page.getByRole('heading', { name: 'Link not valid' }),
      ).toBeVisible();
      await expect(
        page.getByText('This link is invalid or has expired.'),
      ).toBeVisible();
    },
  );

  test(
    'MSG08 · a wrong password is refused and the user stays on SCR-04',
    { tag: '@exception' },
    async ({ page }) => {
      await page.goto('/login');
      await page.getByLabel('Email address').fill(ACCOUNTS.pro);
      await page.getByLabel('Password', { exact: true }).fill('Wrong-Pass1');
      await page.getByRole('button', { name: 'Sign in' }).last().click();
      await expect(
        page.getByText('Incorrect email or password. Please check again.'),
      ).toBeVisible();
      await expect(page).toHaveURL(/\/login/);
    },
  );

  test(
    'BR-03 · five failed sign-ins lock the account (MSG09)',
    { tag: ['@exception', '@state'] },
    async ({ page }) => {
      await page.goto('/login');
      await page.getByLabel('Email address').fill(ACCOUNTS.free);
      const password = page.getByLabel('Password', { exact: true });
      const submit = page.getByRole('button', { name: 'Sign in' }).last();
      for (let attempt = 1; attempt <= 5; attempt += 1) {
        await password.fill('Wrong-Pass' + attempt);
        await submit.click();
        await expect(
          page.getByText('Incorrect email or password. Please check again.'),
        ).toBeVisible();
      }
      await password.fill(DEV_PASSWORD);
      await submit.click();
      await expect(page.getByText(/locked|try again/i).first()).toBeVisible();
      await expect(page).toHaveURL(/\/login/);
    },
  );

  test(
    'BR-01 MSG11 · an unverified account cannot sign in',
    { tag: '@exception' },
    async ({ page }) => {
      await page.goto('/login');
      await page.getByLabel('Email address').fill(ACCOUNTS.unverified);
      await page.getByLabel('Password', { exact: true }).fill(DEV_PASSWORD);
      await page.getByRole('button', { name: 'Sign in' }).last().click();
      await expect(page.getByText(/verif/i).first()).toBeVisible();
      await expect(page).toHaveURL(/\/login/);
    },
  );
});

test.describe('Access by role (SRS 3.1.3)', () => {
  test(
    'SRS 3.1.3 · a Guest opening a Trader screen is sent to sign in',
    { tag: '@rbac' },
    async ({ page }) => {
      await page.goto('/plans');
      await expect(page).toHaveURL(/\/login/);
    },
  );

  test(
    'SRS 3.1.3 · a Trader cannot open the admin console',
    { tag: '@rbac' },
    async ({ page }) => {
      await signIn(page, ACCOUNTS.pro);
      await open(page, '/admin');
      await expect(
        page.getByRole('heading', { name: 'Access denied' }),
      ).toBeVisible();
      await expect(
        page.getByRole('link', { name: 'Return home' }),
      ).toBeVisible();
    },
  );
});
