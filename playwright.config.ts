import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests of the web workflows (TECHNICAL_DESIGN 11.1, E2E row).
 * They drive the real application in a browser against the development
 * fixtures (`src/dev`), which only load in the Vite dev server, so the run
 * needs no backend and gives the same data every time. The desktop project
 * uses a Vietnamese browser and time zone, as the owner's; the phone
 * project runs the tests tagged `@mobile` at 390 px.
 */
const PORT = 4175;
const CI = Boolean(process.env.CI);
// Locally the installed Edge is used; CI installs Playwright's Chromium.
const channel = CI ? undefined : (process.env.E2E_CHANNEL ?? 'msedge');

export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  expect: { timeout: 8_000 },
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  workers: CI ? 2 : 3,
  reporter: [
    ['list'],
    ['json', { outputFile: 'reports/e2e/results.json' }],
    ['junit', { outputFile: 'reports/e2e/junit.xml' }],
    ['html', { outputFolder: 'reports/e2e/html', open: 'never' }],
  ],
  outputDir: 'reports/e2e/artifacts',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        channel,
        viewport: { width: 1440, height: 900 },
        locale: 'vi-VN',
        timezoneId: 'Asia/Ho_Chi_Minh',
      },
    },
    {
      name: 'phone',
      grep: /@mobile/,
      use: {
        ...devices['Pixel 7'],
        channel,
        viewport: { width: 390, height: 844 },
        locale: 'en-US',
        timezoneId: 'UTC',
      },
    },
  ],
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !CI,
    timeout: 120_000,
    env: {
      VITE_ENABLE_DEV_FIXTURES: 'true',
      VITE_ENABLE_PAPER_TRADING: 'true',
      VITE_API_BASE_URL: '',
      VITE_WS_URL: '',
    },
  },
});
