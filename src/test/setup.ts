import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Component tests opt into jsdom per file (`@vitest-environment jsdom`).
afterEach(() => {
  if (typeof document !== 'undefined') cleanup();
});
