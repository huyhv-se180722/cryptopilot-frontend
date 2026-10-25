import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Playwright owns `e2e/`; Vitest runs the unit and component tests.
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'node',
    // One worker per logical core oversubscribes the CPU with the jsdom
    // screen tests: the first test of a file then misses its 5 s budget
    // while it waits for its imports. Half the cores runs the suite faster.
    maxWorkers: '50%',
    clearMocks: true,
    restoreMocks: true,
    setupFiles: ['./src/test/setup.ts'],
  },
});
