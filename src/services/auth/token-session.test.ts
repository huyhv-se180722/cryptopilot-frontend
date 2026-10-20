import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ServiceError } from '../api/errors';
import { REFRESH_LEAD_MS, TokenSession, type TokenPair } from './token-session';

const NOW = Date.parse('2026-10-08T10:00:00Z');

function pair(n: number, accessMinutes = 15): TokenPair {
  return {
    accessToken: 'access-' + n,
    accessTokenExpiresAt: new Date(NOW + accessMinutes * 60_000).toISOString(),
    refreshToken: 'refresh-' + n,
    refreshTokenExpiresAt: new Date(NOW + 7 * 86_400_000).toISOString(),
  };
}

describe('TokenSession', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  it('runs one refresh for concurrent callers and replaces both tokens', async () => {
    const renew = vi.fn(async () => pair(2));
    const session = new TokenSession(renew);
    session.set(pair(1));
    const outcomes = await Promise.all([
      session.refresh(),
      session.refresh(),
      session.refresh(),
    ]);
    expect(outcomes).toEqual(['renewed', 'renewed', 'renewed']);
    expect(renew).toHaveBeenCalledTimes(1);
    expect(renew).toHaveBeenCalledWith('refresh-1');
    expect(session.accessToken()).toBe('access-2');
    expect(session.refreshToken()).toBe('refresh-2');
  });

  it('ends the session and notifies when the server refuses the refresh', async () => {
    const session = new TokenSession(async () => {
      throw new ServiceError('refused', 'HTTP_ERROR', 401);
    });
    const ended = vi.fn();
    session.onEnded(ended);
    session.set(pair(1));
    expect(await session.refresh()).toBe('ended');
    expect(session.hasTokens()).toBe(false);
    expect(ended).toHaveBeenCalledTimes(1);
  });

  it('keeps the session when the refresh cannot reach the server', async () => {
    const session = new TokenSession(async () => {
      throw new ServiceError('offline', 'NETWORK_ERROR');
    });
    const ended = vi.fn();
    session.onEnded(ended);
    session.set(pair(1));
    expect(await session.refresh()).toBe('unavailable');
    expect(session.accessToken()).toBe('access-1');
    expect(ended).not.toHaveBeenCalled();
  });

  it('renews about a minute before the access token expires', async () => {
    const renew = vi.fn(async () => pair(2, 30));
    const session = new TokenSession(renew);
    session.set(pair(1, 15));
    await vi.advanceTimersByTimeAsync(15 * 60_000 - REFRESH_LEAD_MS - 1);
    expect(renew).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(renew).toHaveBeenCalledTimes(1);
    expect(session.accessToken()).toBe('access-2');
  });

  it('hands a valid access token, renewing one about to expire first', async () => {
    const renew = vi.fn(async () => pair(2, 30));
    const session = new TokenSession(renew);
    expect(await session.validAccessToken()).toBeNull();
    session.set(pair(1, 15));
    expect(await session.validAccessToken()).toBe('access-1');
    expect(renew).not.toHaveBeenCalled();
    // Woken up after the expiry, before the scheduled renewal ran.
    vi.setSystemTime(NOW + 15 * 60_000);
    expect(await session.validAccessToken()).toBe('access-2');
    expect(renew).toHaveBeenCalledTimes(1);
  });

  it('forgets tokens on local sign-out without reporting an expiry', async () => {
    const renew = vi.fn(async () => pair(2));
    const session = new TokenSession(renew);
    const ended = vi.fn();
    session.onEnded(ended);
    session.set(pair(1));
    session.clear();
    await vi.advanceTimersByTimeAsync(20 * 60_000);
    expect(renew).not.toHaveBeenCalled();
    expect(ended).not.toHaveBeenCalled();
    expect(await session.refresh()).toBe('ended');
  });
});
