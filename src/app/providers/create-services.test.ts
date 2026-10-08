import { afterEach, describe, expect, it, vi } from 'vitest';
import { createServices } from './create-services';

const env = (apiBaseUrl: string) => ({
  apiBaseUrl,
  wsUrl: '',
  useDevFixtures: false,
});

describe('createServices', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('stays pending without an API base URL and never calls the network', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    const services = await createServices(env(''));
    expect(services.mode).toBe('backend-pending');
    await expect(
      services.auth.login({
        email: 'a@b.test',
        password: 'x',
        rememberMe: false,
      }),
    ).rejects.toMatchObject({ code: 'NOT_CONFIGURED' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('signs in through the backend auth API when a base URL is configured', async () => {
    const fetcher = vi.fn<typeof fetch>(
      async () =>
        new Response(
          JSON.stringify({ code: 'INVALID_CREDENTIALS', messageCode: 'MSG08' }),
          { status: 401 },
        ),
    );
    vi.stubGlobal('fetch', fetcher);
    const services = await createServices(env('http://localhost:8080/api/v1'));
    expect(services.mode).toBe('backend');
    await expect(
      services.auth.login({
        email: 'a@b.test',
        password: 'x',
        rememberMe: false,
      }),
    ).rejects.toMatchObject({ problem: { messageCode: 'MSG08' } });
    expect(String(fetcher.mock.calls[0]?.[0])).toBe(
      'http://localhost:8080/api/v1/auth/login',
    );
  });
});
