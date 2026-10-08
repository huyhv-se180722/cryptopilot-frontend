import { describe, expect, it } from 'vitest';
import type { AuthState } from '../../services/auth/auth-store';
import type { AccountRole, AccountStatus, Session } from '../../types/domain';
import { decideAccess, homePathFor } from './access-decision';

function session(role: AccountRole, status: AccountStatus = 'active'): Session {
  return {
    user: { id: 'u1', email: 'u@example.test', fullName: 'U', role, status },
    entitlements: { aiAccess: false, videoPosting: false },
  };
}
const ready = (value: Session | null): AuthState => ({
  status: 'ready',
  session: value,
});
const trader = { kind: 'roles', roles: ['Trader'] } as const;
const admin = { kind: 'roles', roles: ['Admin'] } as const;
const guestOnly = { kind: 'guest-only' } as const;

describe('decideAccess — protected areas', () => {
  it('waits while the session is restoring', () => {
    expect(decideAccess({ status: 'loading', session: null }, trader)).toEqual({
      type: 'loading',
    });
  });

  it('reports an unavailable session check instead of treating it as a guest', () => {
    expect(
      decideAccess({ status: 'error', session: null, message: 'x' }, trader),
    ).toEqual({ type: 'unavailable' });
  });

  it('sends confirmed guests to sign in', () => {
    expect(decideAccess(ready(null), trader)).toEqual({ type: 'login' });
  });

  it('blocks locked or banned accounts before any role check', () => {
    expect(decideAccess(ready(session('Trader', 'suspended')), trader)).toEqual(
      { type: 'blocked', status: 'suspended' },
    );
    expect(decideAccess(ready(session('Admin', 'banned')), admin)).toEqual({
      type: 'blocked',
      status: 'banned',
    });
  });

  it('keeps roles separate in both directions', () => {
    expect(decideAccess(ready(session('Admin')), trader)).toEqual({
      type: 'denied',
      home: '/admin',
    });
    expect(decideAccess(ready(session('Trader')), admin)).toEqual({
      type: 'denied',
      home: '/dashboard',
    });
    expect(decideAccess(ready(session('Trader')), trader)).toEqual({
      type: 'allow',
    });
  });
});

describe('decideAccess — guest-only screens (SCR-02…06)', () => {
  it('lets guests in, even when the session check is unavailable', () => {
    expect(decideAccess(ready(null), guestOnly)).toEqual({ type: 'allow' });
    expect(
      decideAccess({ status: 'error', session: null, message: 'x' }, guestOnly),
    ).toEqual({ type: 'allow' });
  });

  it('sends signed-in users to their role home', () => {
    expect(decideAccess(ready(session('Trader')), guestOnly)).toEqual({
      type: 'home',
      path: '/dashboard',
    });
    expect(decideAccess(ready(session('Admin')), guestOnly)).toEqual({
      type: 'home',
      path: '/admin',
    });
  });

  it('maps roles to SCR-08 and SCR-33', () => {
    expect(homePathFor('Trader')).toBe('/dashboard');
    expect(homePathFor('Admin')).toBe('/admin');
  });
});
