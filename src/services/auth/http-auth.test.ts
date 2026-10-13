import { describe, expect, it, vi } from 'vitest';
import { createHttpClient, type HttpClient } from '../api/http-client';
import { createHttpAuthService, createRefresher } from './http-auth';
import { browserSessionStore, type SessionStore } from './session-store';
import { TokenSession } from './token-session';
import { decodeSession, subjectOf } from './auth-dto';

/** Test-only token: header.payload.signature with a base64url payload. */
function jwt(sub: string) {
  const payload = btoa(JSON.stringify({ sub, role: 'TRADER' }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return 'eyJhbGciOiJIUzI1NiJ9.' + payload + '.signature';
}
const LATER = '2099-01-01T00:00:00Z';
function sessionBody(n: number, role = 'TRADER') {
  return {
    accessToken: jwt('0199a1b2-0000-7000-8000-00000000000' + n),
    accessTokenExpiresAt: LATER,
    refreshToken: 'refresh-' + n,
    refreshTokenExpiresAt: LATER,
    role,
  };
}
const json = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status });

type Route = (init: RequestInit) => Response | Promise<Response>;

/** A Storage over a map, standing in for the tab's sessionStorage. */
function fakeStorage(): Storage {
  const items = new Map<string, string>();
  return {
    get length() {
      return items.size;
    },
    clear: () => items.clear(),
    getItem: (key) => items.get(key) ?? null,
    key: (index) => [...items.keys()][index] ?? null,
    removeItem: (key) => void items.delete(key),
    setItem: (key, value) => void items.set(key, value),
  };
}

function setup(routes: Record<string, Route>, store?: SessionStore) {
  const calls: { path: string; init: RequestInit }[] = [];
  const fetcher = vi.fn<typeof fetch>(async (input, init = {}) => {
    const path = new URL(String(input)).pathname.replace('/api/v1/', '');
    calls.push({ path, init });
    const route = routes[path];
    return route
      ? route(init)
      : json(404, { code: 'RESOURCE_NOT_FOUND', messageCode: 'MSG41' });
  });
  const holder: { http?: HttpClient } = {};
  const tokens = new TokenSession(
    createRefresher(() => holder.http as HttpClient),
    undefined,
    store,
  );
  const http = createHttpClient({
    baseUrl: 'https://api.example.test/api/v1',
    fetcher,
    session: tokens,
  });
  holder.http = http;
  return { auth: createHttpAuthService(http, tokens, store), tokens, calls };
}
const body = (init: RequestInit) =>
  JSON.parse(String(init.body)) as Record<string, unknown>;
const bearer = (init: RequestInit) =>
  (init.headers as Record<string, string>).Authorization;

describe('auth decoders', () => {
  it('maps the backend role and rejects unknown shapes', () => {
    expect(decodeSession(sessionBody(1, 'ADMIN')).role).toBe('Admin');
    expect(() => decodeSession({ ...sessionBody(1), role: 'ROOT' })).toThrow();
    expect(() =>
      decodeSession({ ...sessionBody(1), accessTokenExpiresAt: 'soon' }),
    ).toThrow();
  });
  it('reads the account id from the token subject', () => {
    expect(subjectOf(jwt('abc'))).toBe('abc');
    expect(() => subjectOf('not-a-token')).toThrow();
  });
});

describe('HTTP auth adapter', () => {
  it('signs a trader in, loads the profile with the bearer token', async () => {
    const { auth, calls } = setup({
      'auth/login': () => json(200, sessionBody(1)),
      'me/profile': () =>
        json(200, {
          email: 'pro@example.test',
          displayName: 'Pro Trader',
          avatarUrl: null,
        }),
    });
    const session = await auth.login({
      email: ' pro@example.test ',
      password: 'Abcdef12',
      rememberMe: true,
    });
    expect(session).toEqual({
      user: {
        id: '0199a1b2-0000-7000-8000-000000000001',
        email: 'pro@example.test',
        displayName: 'Pro Trader',
        role: 'Trader',
        status: 'active',
      },
      entitlements: 'unknown',
    });
    expect(body(calls[0]!.init)).toEqual({
      email: 'pro@example.test',
      password: 'Abcdef12',
      rememberMe: true,
    });
    expect(bearer(calls[0]!.init)).toBeUndefined();
    expect(bearer(calls[1]!.init)).toBe('Bearer ' + sessionBody(1).accessToken);
  });

  it('does not call the Trader-only profile for an admin', async () => {
    const { auth, calls } = setup({
      'auth/login': () => json(200, sessionBody(1, 'ADMIN')),
    });
    const session = await auth.login({
      email: 'admin@example.test',
      password: 'x',
      rememberMe: false,
    });
    expect(session.user).toMatchObject({
      role: 'Admin',
      email: 'admin@example.test',
    });
    expect(calls.map((call) => call.path)).toEqual(['auth/login']);
  });

  it('keeps wrong credentials as MSG08 without touching the session', async () => {
    const { auth, tokens } = setup({
      'auth/login': () =>
        json(401, { code: 'INVALID_CREDENTIALS', messageCode: 'MSG08' }),
    });
    const ended = vi.fn();
    tokens.onEnded(ended);
    await expect(
      auth.login({ email: 'a@b.test', password: 'x', rememberMe: false }),
    ).rejects.toMatchObject({ problem: { messageCode: 'MSG08' } });
    expect(tokens.hasTokens()).toBe(false);
    expect(ended).not.toHaveBeenCalled();
  });

  it('renews an expired access token once and retries the profile call', async () => {
    let profileCalls = 0;
    const { auth, calls } = setup({
      'auth/login': () => json(200, sessionBody(1)),
      'auth/refresh': () => json(200, sessionBody(2)),
      'me/profile': () =>
        ++profileCalls === 1
          ? json(401, { code: 'AUTHENTICATION_REQUIRED', messageCode: 'MSG44' })
          : json(200, { email: 'a@b.test', displayName: 'A' }),
    });
    await auth.login({ email: 'a@b.test', password: 'x', rememberMe: false });
    const refresh = calls.find((call) => call.path === 'auth/refresh');
    expect(body(refresh!.init)).toEqual({ refreshToken: 'refresh-1' });
    expect(bearer(calls.at(-1)!.init)).toBe(
      'Bearer ' + sessionBody(2).accessToken,
    );
  });

  it('reports an ended session when the refresh token is refused', async () => {
    let profileCalls = 0;
    const { auth, tokens } = setup({
      'auth/login': () => json(200, sessionBody(1)),
      'auth/refresh': () =>
        json(401, { code: 'SESSION_EXPIRED', messageCode: 'MSG44' }),
      'me/profile': () =>
        ++profileCalls === 1
          ? json(200, { email: 'a@b.test', displayName: 'A' })
          : json(401, {
              code: 'AUTHENTICATION_REQUIRED',
              messageCode: 'MSG44',
            }),
    });
    const ended = vi.fn();
    auth.onSessionEnded?.(ended);
    await auth.login({ email: 'a@b.test', password: 'x', rememberMe: false });
    await expect(
      auth.login({ email: 'a@b.test', password: 'x', rememberMe: false }),
    ).rejects.toMatchObject({ status: 401 });
    expect(ended).toHaveBeenCalledTimes(1);
    expect(tokens.hasTokens()).toBe(false);
    expect(await auth.restoreSession()).toBeNull();
  });

  it('logs out with the refresh token and forgets the session even if it fails', async () => {
    const { auth, calls, tokens } = setup({
      'auth/login': () => json(200, sessionBody(1)),
      'me/profile': () => json(200, { email: 'a@b.test', displayName: 'A' }),
      'auth/logout': () => {
        throw new TypeError('offline');
      },
    });
    await auth.login({ email: 'a@b.test', password: 'x', rememberMe: false });
    await expect(auth.logout()).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
    });
    expect(body(calls.at(-1)!.init)).toEqual({ refreshToken: 'refresh-1' });
    expect(tokens.hasTokens()).toBe(false);
    expect(await auth.restoreSession()).toBeNull();
  });

  it('keeps the refresh token in the tab and resumes after a reload (D-102)', async () => {
    const storage = fakeStorage();
    const profile = () =>
      json(200, { email: 'a@b.test', displayName: 'A', avatarUrl: null });
    const first = setup(
      {
        'auth/login': () => json(200, sessionBody(1)),
        'me/profile': profile,
      },
      browserSessionStore(() => storage),
    );
    await first.auth.login({
      email: 'a@b.test',
      password: 'x',
      rememberMe: false,
    });
    const kept = JSON.parse(storage.getItem('cp-session') ?? '{}') as Record<
      string,
      string
    >;
    expect(kept).toEqual({
      refreshToken: 'refresh-1',
      refreshTokenExpiresAt: LATER,
      email: 'a@b.test',
    });
    expect(JSON.stringify(kept)).not.toContain(sessionBody(1).accessToken);

    // A new page in the same tab: nothing in memory, the token in storage.
    const reload = setup(
      {
        'auth/refresh': () => json(200, sessionBody(2)),
        'me/profile': profile,
      },
      browserSessionStore(() => storage),
    );
    const session = await reload.auth.restoreSession();
    expect(session?.user.email).toBe('a@b.test');
    expect(body(reload.calls[0]!.init)).toEqual({ refreshToken: 'refresh-1' });
    expect(storage.getItem('cp-session')).toContain('refresh-2');

    // A start that restores twice at once (React's strict mode does)
    // presents the stored token once: twice would read as reuse.
    const twice = setup(
      {
        'auth/refresh': () => json(200, sessionBody(3)),
        'me/profile': profile,
      },
      browserSessionStore(() => storage),
    );
    const [a, b] = await Promise.all([
      twice.auth.restoreSession(),
      twice.auth.restoreSession(),
    ]);
    expect(a).toBe(b);
    expect(
      twice.calls.filter((call) => call.path === 'auth/refresh'),
    ).toHaveLength(1);

    await twice.auth.logout().catch(() => undefined);
    expect(storage.getItem('cp-session')).toBeNull();
  });

  it('forgets a refused or expired stored token and keeps it when offline', async () => {
    const saved = (expiresAt = LATER) => {
      const storage = fakeStorage();
      storage.setItem(
        'cp-session',
        JSON.stringify({
          refreshToken: 'refresh-9',
          refreshTokenExpiresAt: expiresAt,
          email: 'a@b.test',
        }),
      );
      return storage;
    };
    const refused = saved();
    const one = setup(
      {
        'auth/refresh': () =>
          json(401, { code: 'SESSION_EXPIRED', messageCode: 'MSG44' }),
      },
      browserSessionStore(() => refused),
    );
    expect(await one.auth.restoreSession()).toBeNull();
    expect(refused.getItem('cp-session')).toBeNull();

    const expired = saved('2020-01-01T00:00:00Z');
    const two = setup(
      {},
      browserSessionStore(() => expired),
    );
    expect(await two.auth.restoreSession()).toBeNull();
    expect(two.calls).toHaveLength(0);
    expect(expired.getItem('cp-session')).toBeNull();

    const offline = saved();
    const three = setup(
      {
        'auth/refresh': () => {
          throw new TypeError('offline');
        },
      },
      browserSessionStore(() => offline),
    );
    await expect(three.auth.restoreSession()).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
    });
    expect(offline.getItem('cp-session')).toContain('refresh-9');
  });

  it('keeps nothing when the browser refuses storage', async () => {
    const blocked = () => {
      throw new DOMException('denied', 'SecurityError');
    };
    const { auth } = setup(
      {
        'auth/login': () => json(200, sessionBody(1)),
        'me/profile': () => json(200, { email: 'a@b.test', displayName: 'A' }),
      },
      browserSessionStore(blocked),
    );
    const session = await auth.login({
      email: 'a@b.test',
      password: 'x',
      rememberMe: false,
    });
    expect(session.user.email).toBe('a@b.test');
  });

  it('changes the password with the bearer token and keeps the session', async () => {
    const { auth, tokens, calls } = setup({
      'auth/login': () => json(200, sessionBody(1, 'ADMIN')),
      'me/password': () => json(200, { messageCode: 'MSG14' }),
    });
    await auth.login({
      email: 'admin@example.test',
      password: 'Abcdef12',
      rememberMe: false,
    });
    const change = {
      currentPassword: 'Abcdef12',
      newPassword: 'Abcdef34',
      confirmPassword: 'Abcdef34',
    };
    await expect(auth.changePassword(change)).resolves.toEqual({
      messageCode: 'MSG14',
    });
    expect(calls[1]!.path).toBe('me/password');
    expect(calls[1]!.init.method).toBe('PUT');
    expect(body(calls[1]!.init)).toEqual(change);
    expect(bearer(calls[1]!.init)).toBe(
      'Bearer ' + sessionBody(1, 'ADMIN').accessToken,
    );
    expect(tokens.hasTokens()).toBe(true);
  });

  it('posts the account flows and returns their SRS message', async () => {
    const { auth, calls } = setup({
      'auth/register': () => json(201, { messageCode: 'MSG05' }),
      'auth/verify-email': () => json(200, { messageCode: 'MSG06' }),
      'auth/forgot-password': () => json(202, { messageCode: 'MSG12' }),
      'auth/reset-password': () => json(200, { messageCode: 'MSG13' }),
    });
    await expect(
      auth.register({
        email: 'n@b.test',
        displayName: 'New',
        password: 'Abcdef12',
        confirmPassword: 'Abcdef12',
        acceptsDisclaimer: true,
      }),
    ).resolves.toEqual({ messageCode: 'MSG05' });
    await expect(auth.verifyEmail('tok')).resolves.toEqual({
      messageCode: 'MSG06',
    });
    await expect(auth.forgotPassword('n@b.test')).resolves.toEqual({
      messageCode: 'MSG12',
    });
    await expect(
      auth.resetPassword({
        token: 't',
        newPassword: 'Abcdef12',
        confirmPassword: 'Abcdef12',
      }),
    ).resolves.toEqual({ messageCode: 'MSG13' });
    expect(body(calls[1]!.init)).toEqual({ token: 'tok' });
    expect(calls.every((call) => bearer(call.init) === undefined)).toBe(true);
  });
});
