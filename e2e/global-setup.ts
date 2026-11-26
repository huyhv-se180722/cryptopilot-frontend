import { chromium, type FullConfig } from '@playwright/test';

/**
 * Warms the Vite development server before the first test. Vite compiles the
 * application's modules on the first browser request, which on a loaded
 * machine took longer than one test's 45 s, so whichever test ran first
 * failed at its first screen. One page opened here, with its own long wait,
 * leaves every module compiled.
 */
export default async function globalSetup(config: FullConfig) {
  const project = config.projects[0];
  const baseURL = project?.use.baseURL;
  if (!baseURL) return;
  const browser = await chromium.launch(
    project.use.channel ? { channel: project.use.channel } : {},
  );
  try {
    const page = await browser.newPage();
    await page.goto(`${baseURL}/register`, { timeout: 180_000 });
    // The register form's email field, in whichever language the app opens.
    await page
      .locator('input[type="email"]')
      .first()
      .waitFor({ state: 'visible', timeout: 180_000 });
  } finally {
    await browser.close();
  }
}
