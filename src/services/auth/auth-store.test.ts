import { describe, expect, it, vi } from 'vitest';
import { AuthStore } from './auth-store';
import type { AuthService } from './contracts';
import type { Session } from '../../types/domain';

const session: Session = {
  user: {
    id: 'test-user',
    email: 'user@example.test',
    displayName: 'Test user',
    role: 'Trader',
    status: 'active',
  },
  entitlements: 'unknown',
};
function service(overrides: Partial<AuthService> = {}): AuthService {
  return {
    restoreSession: async () => null,
    login: async () => session,
    register: async () => ({ messageCode: 'MSG05' }),
    verifyEmail: async () => ({ messageCode: 'MSG06' }),
    resendVerification: async () => ({ messageCode: 'MSG05' }),
    forgotPassword: async () => ({ messageCode: 'MSG12' }),
    resetPassword: async () => ({ messageCode: 'MSG13' }),
    logout: async () => undefined,
    ...overrides,
  };
}
describe('session lifecycle', () => {
  it('restores a guest without inventing an account', async () => {
    const store = new AuthStore(service());
    await store.restore();
    expect(store.getSnapshot()).toEqual({ status: 'ready', session: null });
  });
  it('cannot restore an old session after logout', async () => {
    let finish: ((value: Session) => void) | undefined;
    const store = new AuthStore(
      service({
        restoreSession: () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      }),
    );
    const restoring = store.restore();
    await store.logout();
    finish?.(session);
    await restoring;
    expect(store.getSnapshot().session).toBeNull();
  });
  it('clears local access even when remote logout fails', async () => {
    const store = new AuthStore(
      service({
        logout: async () => {
          throw new Error('offline');
        },
      }),
    );
    await store.login({
      email: 'user@example.test',
      password: 'test-only-value',
      rememberMe: false,
    });
    await expect(store.logout()).rejects.toThrow('offline');
    expect(store.getSnapshot()).toMatchObject({
      status: 'ready',
      session: null,
    });
  });
  it('never grants access to inactive accounts', async () => {
    const store = new AuthStore(
      service({
        login: async () => ({
          ...session,
          user: { ...session.user, status: 'banned' },
        }),
      }),
    );
    await store.login({
      email: 'user@example.test',
      password: 'test-only-value',
      rememberMe: false,
    });
    expect(store.getSnapshot()).toMatchObject({
      status: 'error',
      session: null,
    });
  });
  it('cancels session restoration and releases subscribers', async () => {
    let signal: AbortSignal | undefined;
    const store = new AuthStore(
      service({
        restoreSession: async (value) => {
          signal = value;
          return null;
        },
      }),
    );
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    await store.restore();
    unsubscribe();
    listener.mockClear();
    store.cancelPending();
    store.invalidate();
    expect(signal?.aborted).toBe(true);
    expect(listener).not.toHaveBeenCalled();
  });
  it('keeps a guest a guest when sign in is refused', async () => {
    const refusal = new Error('MSG08');
    const store = new AuthStore(
      service({
        login: async () => {
          throw refusal;
        },
      }),
    );
    await store.restore();
    await expect(
      store.login({ email: 'u@example.test', password: 'x', rememberMe: true }),
    ).rejects.toBe(refusal);
    expect(store.getSnapshot()).toEqual({ status: 'ready', session: null });
  });
  it('flags a server-ended session once until acknowledged', async () => {
    const store = new AuthStore(service());
    await store.login({
      email: 'user@example.test',
      password: 'test-only-value',
      rememberMe: false,
    });
    store.invalidate();
    expect(store.getSnapshot()).toEqual({
      status: 'ready',
      session: null,
      ended: 'expired',
    });
    store.acknowledgeEnded();
    expect(store.getSnapshot()).toEqual({ status: 'ready', session: null });
  });
  it('does not report an expiry for a guest', () => {
    const store = new AuthStore(service());
    store.invalidate();
    expect(store.getSnapshot()).toEqual({ status: 'ready', session: null });
  });
});
