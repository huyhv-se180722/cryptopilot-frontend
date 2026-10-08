import { describe, expect, it, vi } from 'vitest';
import { createDevelopmentServices } from './create-development-services';
import { createDevelopmentAuth } from './dev-auth';
import { createDevelopmentMarket } from './dev-market';
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

  it('changes the password of the signed-in account only', async () => {
    const auth = createDevelopmentAuth();
    const change = {
      currentPassword: DEV_PASSWORD,
      newPassword: 'Another-1a',
      confirmPassword: 'Another-1a',
    };
    await expect(auth.changePassword(change)).rejects.toMatchObject({
      problem: { messageCode: 'MSG44' },
    });
    await auth.login({
      email: 'admin@dev.local',
      password: DEV_PASSWORD,
      rememberMe: false,
    });
    await expect(
      auth.changePassword({ ...change, currentPassword: 'wrong' }),
    ).rejects.toMatchObject({
      problem: { code: 'CURRENT_PASSWORD_INCORRECT', messageCode: 'MSG08' },
    });
    await expect(
      auth.changePassword({ ...change, confirmPassword: 'Another-1b' }),
    ).rejects.toMatchObject({
      problem: { fieldErrors: { confirmPasswordMatching: 'MSG03' } },
    });
    await expect(auth.changePassword(change)).resolves.toEqual({
      messageCode: 'MSG14',
    });
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

describe('development profile seam', () => {
  it('saves in memory and refuses like the backend', async () => {
    const { services, request } = await devServices();
    const { profile } = services;
    await expect(
      profile.update({
        displayName: 'A',
        defaultCapital: '0',
        defaultRiskPercent: '12',
        tradingStyle: null,
      }),
    ).rejects.toMatchObject({
      problem: {
        fieldErrors: {
          displayName: 'MSG01',
          defaultCapital: 'MSG15',
          defaultRiskPercent: 'MSG15',
        },
      },
    });
    await profile.update({
      displayName: 'Renamed',
      defaultCapital: '2500.25',
      defaultRiskPercent: null,
      tradingStyle: 'DAY',
    });
    expect(await profile.get()).toMatchObject({
      displayName: 'Renamed',
      defaultCapital: '2500.25',
      defaultRiskPercent: null,
      tradingStyle: 'DAY',
    });
    await expect(
      profile.chooseRiskProfile('AGGRESSIVE', false),
    ).rejects.toMatchObject({ problem: { messageCode: 'MSG48' } });
    await profile.chooseRiskProfile('AGGRESSIVE', true);
    expect(await profile.getRiskProfile()).toMatchObject({
      riskProfile: 'AGGRESSIVE',
      maxFuturesLeverage: 10,
    });
    expect(request).not.toHaveBeenCalled();
  });
});

describe('development market seam', () => {
  it('serves labelled pairs, decimal strings and MSG41 like the backend', async () => {
    const { market } = createDevelopmentMarket(() => Date.UTC(2026, 9, 9));
    const spot = await market.listPairs('spot');
    const futures = await market.listPairs('futures');
    expect(spot.length).toBeGreaterThan(futures.length);
    expect(spot[0]?.baseAssetName).toContain('(fixture)');
    const candles = await market.getCandles({
      market: 'spot',
      symbol: 'BTCUSDT',
      timeframe: '1d',
      limit: 90,
    });
    expect(candles).toHaveLength(90);
    expect(candles[89]?.openTime).toBe('2026-10-08T00:00:00.000Z');
    expect(candles[0]?.close).toMatch(/^\d+\.\d{2}$/);
    expect(await market.getTicker('futures', 'BTCUSDT')).toMatchObject({
      lastPrice: null,
      fundingRate: '0.00010000',
    });
    await expect(market.getTicker('futures', 'ADAUSDT')).rejects.toMatchObject({
      problem: { messageCode: 'MSG41' },
    });
  });

  it('publishes the overview of each subscribed market until the last stops', async () => {
    vi.useFakeTimers();
    try {
      const { marketFeed } = createDevelopmentMarket();
      const listener = vi.fn();
      const stop = marketFeed.subscribeOverview('futures', listener);
      await vi.advanceTimersByTimeAsync(4_000);
      expect(listener.mock.calls.length).toBeGreaterThanOrEqual(3);
      expect(listener.mock.lastCall?.[0]).toMatchObject({ market: 'futures' });
      stop();
      const calls = listener.mock.calls.length;
      await vi.advanceTimersByTimeAsync(4_000);
      expect(listener).toHaveBeenCalledTimes(calls);
    } finally {
      vi.useRealTimers();
    }
  });
});
