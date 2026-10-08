import { describe, expect, it, vi } from 'vitest';
import { createDevelopmentServices } from './create-development-services';
import { createDevelopmentAuth } from './dev-auth';
import { DEV_PASSWORD, DEV_TOKENS } from './fixtures/auth';
import { createServices } from '../app/providers/create-services';

async function devServices() {
  const base = await createServices({
    apiBaseUrl: '',
    wsUrl: '',
    useDevFixtures: false,
  });
  const request = vi.spyOn(base.http, 'request');
  return { services: createDevelopmentServices(base), request };
}

describe('development services', () => {
  it('stay behind the same contracts and never touch the network', async () => {
    const { services, request } = await devServices();
    expect(services.mode).toBe('development-fixtures');
    expect(await services.market.list()).toEqual({
      items: [],
      nextCursor: null,
    });
    await expect(services.journal.list()).rejects.toMatchObject({
      code: 'NOT_CONFIGURED',
    });
    expect(request).not.toHaveBeenCalled();
  });
});

describe('development auth seam (ADR-010)', () => {
  const login = (email: string, password = DEV_PASSWORD) =>
    createDevelopmentAuth().login({ email, password, rememberMe: false });

  it('signs in only the labelled principals with the development password', async () => {
    await expect(login('trader.pro@dev.local')).resolves.toMatchObject({
      user: { role: 'Trader', email: 'trader.pro@dev.local' },
      entitlements: { tier: 'PRO' },
    });
    await expect(login('someone@example.com')).rejects.toMatchObject({
      problem: { code: 'INVALID_CREDENTIALS', messageCode: 'MSG08' },
    });
    await expect(login('trader.pro@dev.local', 'guess')).rejects.toMatchObject({
      problem: { messageCode: 'MSG08' },
    });
  });

  it('refuses unverified, locked and banned accounts like the backend', async () => {
    await expect(login('unverified@dev.local')).rejects.toMatchObject({
      problem: { code: 'EMAIL_NOT_VERIFIED', messageCode: 'MSG11' },
    });
    await expect(login('banned@dev.local')).rejects.toMatchObject({
      problem: { messageCode: 'MSG10', messageArgs: ['BANNED'] },
    });
  });

  it('locks sign in after five failures (MSG09)', async () => {
    const auth = createDevelopmentAuth();
    for (let attempt = 0; attempt < 5; attempt++)
      await auth
        .login({
          email: 'trader.free@dev.local',
          password: 'x',
          rememberMe: false,
        })
        .catch(() => undefined);
    await expect(
      auth.login({
        email: 'trader.free@dev.local',
        password: DEV_PASSWORD,
        rememberMe: false,
      }),
    ).rejects.toMatchObject({ problem: { messageCode: 'MSG09' } });
  });

  it('keeps sessions in memory only', async () => {
    const auth = createDevelopmentAuth();
    await auth.login({
      email: 'admin@dev.local',
      password: DEV_PASSWORD,
      rememberMe: true,
    });
    expect(await auth.restoreSession()).not.toBeNull();
    expect(await createDevelopmentAuth().restoreSession()).toBeNull();
    await auth.logout();
    expect(await auth.restoreSession()).toBeNull();
  });

  it('rejects duplicate registrations and invalid links', async () => {
    const auth = createDevelopmentAuth();
    const form = {
      displayName: 'New Trader',
      password: 'Abcdef12',
      confirmPassword: 'Abcdef12',
      acceptsDisclaimer: true,
    };
    await expect(
      auth.register({ ...form, email: 'new@dev.local' }),
    ).resolves.toEqual({ messageCode: 'MSG05' });
    await expect(
      auth.register({ ...form, email: 'NEW@dev.local' }),
    ).rejects.toMatchObject({ problem: { fieldErrors: { email: 'MSG04' } } });
    await expect(auth.verifyEmail(DEV_TOKENS.valid)).resolves.toEqual({
      messageCode: 'MSG06',
    });
    await expect(auth.verifyEmail('expired')).rejects.toMatchObject({
      problem: { messageCode: 'MSG07' },
    });
  });
});
