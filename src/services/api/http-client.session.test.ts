import { describe, expect, it, vi } from 'vitest';
import { createHttpClient, type SessionCredentials } from './http-client';

const decode = (body: unknown) => body;

function respond(status: number, body: unknown = {}) {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
const unauthorized = () =>
  respond(401, { code: 'AUTHENTICATION_REQUIRED', messageCode: 'MSG44' });

function session(
  outcome: 'renewed' | 'ended' | 'unavailable',
): SessionCredentials & { token: string } {
  const state = {
    token: 'old',
    accessToken: () => state.token,
    refresh: vi.fn(async () => {
      if (outcome === 'renewed') state.token = 'new';
      return outcome;
    }),
  };
  return state;
}
const auth = (init: RequestInit | undefined) =>
  (init?.headers as Record<string, string> | undefined)?.Authorization;

describe('HTTP client session handling', () => {
  it('sends the access token as a bearer header', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(respond(200, { ok: 1 }));
    await createHttpClient({
      baseUrl: 'https://api.example.test/api/v1',
      fetcher,
      session: session('renewed'),
    }).request({ path: 'me/profile', decode });
    expect(auth(fetcher.mock.calls[0]?.[1])).toBe('Bearer old');
  });

  it('renews once on 401 and replays the request with the new token', async () => {
    const credentials = session('renewed');
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(unauthorized())
      .mockResolvedValueOnce(respond(200, { ok: 1 }));
    const onUnauthorized = vi.fn();
    await expect(
      createHttpClient({
        baseUrl: 'https://api.example.test',
        fetcher,
        session: credentials,
        onUnauthorized,
      }).request({ path: 'me/profile', decode }),
    ).resolves.toEqual({ ok: 1 });
    expect(credentials.refresh).toHaveBeenCalledTimes(1);
    expect(auth(fetcher.mock.calls[1]?.[1])).toBe('Bearer new');
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('reports the end of the session when renewal is refused', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(unauthorized());
    const onUnauthorized = vi.fn();
    await expect(
      createHttpClient({
        baseUrl: 'https://api.example.test',
        fetcher,
        session: session('ended'),
        onUnauthorized,
      }).request({ path: 'me/profile', decode }),
    ).rejects.toMatchObject({ status: 401 });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('does not end the session when renewal cannot reach the server', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(unauthorized());
    const onUnauthorized = vi.fn();
    await expect(
      createHttpClient({
        baseUrl: 'https://api.example.test',
        fetcher,
        session: session('unavailable'),
        onUnauthorized,
      }).request({ path: 'me/profile', decode }),
    ).rejects.toMatchObject({ status: 401 });
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('never replays more than once', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => unauthorized());
    const onUnauthorized = vi.fn();
    await expect(
      createHttpClient({
        baseUrl: 'https://api.example.test',
        fetcher,
        session: session('renewed'),
        onUnauthorized,
      }).request({ path: 'me/profile', decode }),
    ).rejects.toMatchObject({ status: 401 });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('keeps anonymous auth calls free of tokens and renewal', async () => {
    const credentials = session('renewed');
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(unauthorized());
    await expect(
      createHttpClient({
        baseUrl: 'https://api.example.test',
        fetcher,
        session: credentials,
      }).request({
        path: 'auth/refresh',
        method: 'POST',
        body: {},
        decode,
        anonymous: true,
      }),
    ).rejects.toMatchObject({ status: 401 });
    expect(auth(fetcher.mock.calls[0]?.[1])).toBeUndefined();
    expect(credentials.refresh).not.toHaveBeenCalled();
  });
});
