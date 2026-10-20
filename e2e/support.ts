import { expect, type Page } from '@playwright/test';

/** The password of every development account (`src/dev/fixtures/auth.ts`). */
export const DEV_PASSWORD = 'DevOnly-2026';

export const ACCOUNTS = {
  free: 'trader.free@dev.local',
  pro: 'trader.pro@dev.local',
  premium: 'trader.premium@dev.local',
  admin: 'admin@dev.local',
  locked: 'locked@dev.local',
  unverified: 'unverified@dev.local',
} as const;

/** Signs in on SCR-04 and waits to leave it. */
export async function signIn(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(DEV_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).last().click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'));
}

/**
 * Moves inside the running application. The development session lives in
 * the page's memory, so a full reload would sign the user out.
 */
export async function open(page: Page, path: string) {
  await page.evaluate((to) => {
    history.pushState({}, '', to);
    dispatchEvent(new PopStateEvent('popstate'));
  }, path);
  await page.waitForURL((url) => url.pathname + url.search === path);
}

/** True when the page is wider than the viewport (CR responsive rule). */
export async function overflowsHorizontally(page: Page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
}

/** Fails the test on any uncaught error of the page. */
export function failOnPageErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  return () => expect(errors, 'uncaught page errors').toEqual([]);
}
