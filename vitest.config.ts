import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Playwright owns `e2e/`; Vitest runs the unit and component tests.
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'node',
    clearMocks: true,
    restoreMocks: true,
    setupFiles: ['./src/test/setup.ts'],
    // Screen tests type with userEvent, one event per key; on a busy machine (backend,
    // Docker and Vite running) a few took longer than the default 5 s and failed only
    // in the full run. A hung test still fails, just later.
    testTimeout: 15_000,
  },
});
