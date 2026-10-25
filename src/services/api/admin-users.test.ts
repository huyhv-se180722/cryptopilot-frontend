import { describe, expect, it, vi } from 'vitest';
import { createHttpClient } from './http-client';
import {
  createHttpAdminUserService,
  decodeAdminUserDetail,
  decodeAdminUserPage,
} from './admin-users';

/** Shapes of `/admin/users/**` on develop @ 14fe5a4. */
const ACCOUNT = {
  userId: '019b76da-a800-7d01-8000-000000000003',
  email: 'trader.premium@cryptopilot.invalid',
  displayName: 'Premium Trader',
  role: 'TRADER',
  status: 'LOCKED',
  plan: 'PREMIUM',
  emailVerified: true,
  lastLoginAt: null,
  createdAt: '2026-01-01T00:00:00Z',
};
const DETAIL = {
  account: ACCOUNT,
  tradingStyle: null,
  riskProfile: 'CONSERVATIVE',
  activity: { plans: 3, posts: 0, trades: 1 },
  recentAudit: [
    {
      recordedAt: '2026-10-25T06:00:00Z',
      actorId: '01a171cf-c911-744b-bdf8-92a920e3d29b',
      action: 'ACCOUNT_LOCKED',
      oldValue: '{"status": "ACTIVE"}',
      newValue: '{"reason": "spam", "status": "LOCKED"}',
      ipAddress: '127.0.0.1',
    },
  ],
};

function setup(answer: (url: URL, init: RequestInit) => unknown) {
  const calls: { url: URL; init: RequestInit }[] = [];
  const http = createHttpClient({
    baseUrl: 'https://api.example.test/api/v1',
    fetcher: vi.fn<typeof fetch>(async (input, init = {}) => {
      const url = new URL(String(input));
      calls.push({ url, init });
      return new Response(JSON.stringify(answer(url, init)), { status: 200 });
    }),
    session: { accessToken: () => 'token-1', refresh: async () => 'renewed' },
  });
  return { users: createHttpAdminUserService(http), calls };
}

describe('admin user decoders', () => {
  it('maps the role and status to the UI words and keeps the audit', () => {
    const detail = decodeAdminUserDetail(DETAIL);
    expect(detail.account.role).toBe('Trader');
    expect(detail.account.status).toBe('locked');
    expect(detail.riskProfile).toBe('CONSERVATIVE');
    expect(detail.activity).toEqual({ plans: 3, posts: 0, trades: 1 });
    expect(detail.recentAudit[0]?.action).toBe('ACCOUNT_LOCKED');
  });

  it('reads a one-based page and rejects unknown values', () => {
    expect(
      decodeAdminUserPage({ items: [ACCOUNT], page: 1, pageSize: 20, total: 1 })
        .items,
    ).toHaveLength(1);
    expect(() =>
      decodeAdminUserDetail({
        ...DETAIL,
        account: { ...ACCOUNT, role: 'GUEST' },
      }),
    ).toThrow();
    expect(() =>
      decodeAdminUserDetail({ ...DETAIL, activity: { plans: -1 } }),
    ).toThrow();
  });
});

describe('HTTP admin user adapter', () => {
  it('searches with the wire filters and a page of 20', async () => {
    const { users, calls } = setup(() => ({
      items: [],
      page: 2,
      pageSize: 20,
      total: 21,
    }));
    await users.search({
      q: 'alex',
      role: 'Trader',
      status: 'locked',
      plan: 'PRO',
      page: 2,
    });
    const params = Object.fromEntries(calls[0]?.url.searchParams ?? []);
    expect(calls[0]?.url.pathname).toBe('/api/v1/admin/users');
    expect(params).toEqual({
      page: '2',
      pageSize: '20',
      q: 'alex',
      role: 'TRADER',
      status: 'LOCKED',
      plan: 'PRO',
    });
  });

  it('sends each action and the role with the reason', async () => {
    const { users, calls } = setup(() => DETAIL);
    await users.act(ACCOUNT.userId, 'unlock', 'appeal accepted');
    await users.changeRole(ACCOUNT.userId, 'Admin', 'new moderator');
    expect(calls.map((c) => [c.init.method, c.url.pathname])).toEqual([
      ['POST', `/api/v1/admin/users/${ACCOUNT.userId}/unlock`],
      ['PUT', `/api/v1/admin/users/${ACCOUNT.userId}/role`],
    ]);
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({
      reason: 'appeal accepted',
    });
    expect(JSON.parse(String(calls[1]?.init.body))).toEqual({
      role: 'ADMIN',
      reason: 'new moderator',
    });
  });
});
