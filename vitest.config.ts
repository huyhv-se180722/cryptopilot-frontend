import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    clearMocks: true,
    restoreMocks: true,
    setupFiles: ['./src/test/setup.ts'],
  },
});
