import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Playwright owns `e2e/`; Vitest runs the unit and component tests.
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'node',
    clearMocks: true,
    restoreMocks: true,
    setupFiles: ['./src/test/setup.ts'],
  },
});
