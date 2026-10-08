import { describe, expect, it, vi } from 'vitest';
import { createHttpClient } from './http-client';
import {
  createHttpProfileService,
  createPendingProfileService,
} from './profile';
import {
  decodeProfile,
  decodeQuestionnaire,
  decodeRiskProfile,
  decodeSuggestion,
} from './profile-dto';

/** Shapes from fe-guide modules/user.md, checked against develop @ 0d92def. */
const PROFILE = {
  email: 'trader.pro@cryptopilot.invalid',
  displayName: 'Pro Trader',
  avatarUrl: null,
  defaultCapital: '1000',
  defaultRiskPercent: '1.000',
  tradingStyle: 'SWING',
  riskProfile: 'CONSERVATIVE',
  notifyEmail: true,
  notifyPush: false,
};
const RISK = {
  riskProfile: 'BALANCED',
  riskPerTradePercent: '1',
  maxFuturesLeverage: 5,
  maxTotalOpenRiskPercent: '5',
};
const QUESTIONNAIRE = {
  questions: [
    {
      code: 'CAPACITY_SHARE_OF_SAVINGS',
      group: 'CAPACITY',
      text: 'What share of your savings is the capital you trade with?',
      options: [
        { code: 'MORE_THAN_HALF', text: 'More than half' },
        { code: 'LESS_THAN_A_FIFTH', text: 'Less than a fifth' },
      ],
    },
  ],
};
const SAVED = { messageCode: 'MSG14' };

const json = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status });

function setup(reply: (path: string, init: RequestInit) => Response) {
  const calls: { path: string; method: string; body: unknown }[] = [];
  const fetcher = vi.fn<typeof fetch>(async (input, init = {}) => {
    const path = new URL(String(input)).pathname.replace('/api/v1/', '');
    calls.push({
      path,
      method: init.method ?? 'GET',
      body: init.body ? JSON.parse(String(init.body)) : undefined,
    });
    return reply(path, init);
  });
  const http = createHttpClient({
    baseUrl: 'https://api.example.test/api/v1',
    fetcher,
  });
  return { profile: createHttpProfileService(http), calls };
}

describe('profile decoders', () => {
  it('keep decimals as strings and accept cleared fields', () => {
    expect(decodeProfile(PROFILE)).toEqual(PROFILE);
    expect(
      decodeProfile({
        ...PROFILE,
        defaultCapital: null,
        defaultRiskPercent: null,
        tradingStyle: null,
      }),
    ).toMatchObject({
      defaultCapital: null,
      defaultRiskPercent: null,
      tradingStyle: null,
    });
    expect(decodeRiskProfile(RISK)).toEqual(RISK);
    expect(decodeQuestionnaire(QUESTIONNAIRE)).toEqual(QUESTIONNAIRE.questions);
  });

  it('reject values outside the contract', () => {
    expect(() => decodeProfile({ ...PROFILE, defaultCapital: 1000 })).toThrow();
    expect(() => decodeProfile({ ...PROFILE, tradingStyle: 'HODL' })).toThrow();
    expect(() => decodeProfile({ ...PROFILE, riskProfile: null })).toThrow();
    expect(() =>
      decodeRiskProfile({ ...RISK, maxFuturesLeverage: 2.5 }),
    ).toThrow();
    expect(() => decodeQuestionnaire({ questions: [] })).toThrow();
    expect(() =>
      decodeSuggestion({
        capacityScore: 8,
        attitudeScore: 6,
        suggestedProfile: 'YOLO',
      }),
    ).toThrow();
  });
});

describe('HTTP profile service', () => {
  it('reads the profile, risk profile and questionnaire', async () => {
    const { profile, calls } = setup((path) =>
      json(
        200,
        path === 'me/profile'
          ? PROFILE
          : path === 'me/risk-profile'
            ? RISK
            : QUESTIONNAIRE,
      ),
    );
    await expect(profile.get()).resolves.toEqual(PROFILE);
    await expect(profile.getRiskProfile()).resolves.toEqual(RISK);
    await expect(profile.getQuestionnaire()).resolves.toHaveLength(1);
    expect(calls.map((call) => call.path)).toEqual([
      'me/profile',
      'me/risk-profile',
      'me/risk-questionnaire',
    ]);
  });

  it('sends the request field names the backend expects', async () => {
    const { profile, calls } = setup((path) =>
      path === 'me/risk-questionnaire'
        ? json(200, {
            capacityScore: 8,
            attitudeScore: 6,
            suggestedProfile: 'BALANCED',
          })
        : json(200, SAVED),
    );
    await profile.update({
      displayName: 'Pro Trader',
      defaultCapital: '1000.5',
      defaultRiskPercent: null,
      tradingStyle: 'DAY',
    });
    await profile.updateNotifications({ email: false, push: true });
    await profile.chooseRiskProfile('AGGRESSIVE', true);
    await expect(
      profile.suggestRiskProfile({
        CAPACITY_SHARE_OF_SAVINGS: 'MORE_THAN_HALF',
      }),
    ).resolves.toEqual({
      capacityScore: 8,
      attitudeScore: 6,
      suggestedProfile: 'BALANCED',
    });
    await profile.changePassword({
      currentPassword: 'Old-pass1',
      newPassword: 'New-pass1',
      confirmPassword: 'New-pass1',
    });
    expect(calls).toEqual([
      {
        path: 'me/profile',
        method: 'PUT',
        body: {
          displayName: 'Pro Trader',
          defaultCapital: '1000.5',
          defaultRiskPercent: null,
          tradingStyle: 'DAY',
        },
      },
      {
        path: 'me/notification-preferences',
        method: 'PUT',
        body: { email: false, push: true },
      },
      {
        path: 'me/risk-profile',
        method: 'PUT',
        body: { riskProfile: 'AGGRESSIVE', confirmAggressive: true },
      },
      {
        path: 'me/risk-questionnaire',
        method: 'POST',
        body: { answers: { CAPACITY_SHARE_OF_SAVINGS: 'MORE_THAN_HALF' } },
      },
      {
        path: 'me/password',
        method: 'PUT',
        body: {
          currentPassword: 'Old-pass1',
          newPassword: 'New-pass1',
          confirmPassword: 'New-pass1',
        },
      },
    ]);
  });

  it('passes the MSG48 refusal through as a problem', async () => {
    const { profile } = setup(() =>
      json(400, {
        code: 'RISK_PROFILE_CONFIRMATION_REQUIRED',
        messageCode: 'MSG48',
      }),
    );
    await expect(
      profile.chooseRiskProfile('AGGRESSIVE', false),
    ).rejects.toMatchObject({
      status: 400,
      problem: {
        code: 'RISK_PROFILE_CONFIRMATION_REQUIRED',
        messageCode: 'MSG48',
      },
    });
  });

  it('refuses an unexpected payload instead of guessing', async () => {
    const { profile } = setup(() =>
      json(200, { ...PROFILE, notifyPush: 'yes' }),
    );
    await expect(profile.get()).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    });
  });
});

describe('pending profile service', () => {
  it('fails every operation with NOT_CONFIGURED', async () => {
    const pending = createPendingProfileService();
    await expect(pending.get()).rejects.toMatchObject({
      code: 'NOT_CONFIGURED',
    });
    await expect(
      pending.chooseRiskProfile('BALANCED', false),
    ).rejects.toMatchObject({ code: 'NOT_CONFIGURED' });
  });
});
