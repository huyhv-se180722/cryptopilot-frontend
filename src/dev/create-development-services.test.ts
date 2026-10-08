import { expect, it, vi } from 'vitest';
import { createDevelopmentServices } from './create-development-services';
import { createServices } from '../app/providers/create-services';

it('keeps empty market fixtures behind the same service contract without impersonating a user', async () => {
  const base = await createServices({
    apiBaseUrl: '',
    wsUrl: '',
    useDevFixtures: false,
  });
  const request = vi.spyOn(base.http, 'request');
  const services = createDevelopmentServices(base);
  expect(services.mode).toBe('development-fixtures');
  expect(await services.market.list()).toEqual({ items: [], nextCursor: null });
  expect(request).not.toHaveBeenCalled();
  await expect(
    services.auth.login({
      email: 'user@example.test',
      password: 'test-only-value',
      rememberMe: false,
    }),
  ).rejects.toMatchObject({ code: 'NOT_CONFIGURED' });
  await expect(services.journal.list()).rejects.toMatchObject({
    code: 'NOT_CONFIGURED',
  });
});
