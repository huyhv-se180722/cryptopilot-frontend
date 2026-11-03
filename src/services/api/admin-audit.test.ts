import { describe, expect, it, vi } from 'vitest';
import { createHttpClient } from './http-client';
import {
  createHttpAdminAuditService,
  decodeAuditLogPage,
  decodeSystemEventPage,
  decodeSystemHealth,
} from './admin-audit';

/** Shapes of the backend `feat/uc-52-audit-log` (UC-46). */
const ENTRY = {
  id: '019b76da-a800-7d01-8000-0000000000a1',
  recordedAt: '2026-11-03T06:00:00Z',
  actor: {
    id: '019b76da-a800-7000-8000-000000000001',
    email: 'admin@cryptopilot.invalid',
    displayName: null,
    role: 'ADMIN',
  },
  action: 'ACCOUNT_LOCKED',
  entityType: 'USER_ACCOUNT',
  entityId: '019b76da-a800-7d01-8000-000000000003',
  ipAddress: '203.0.113.7',
  oldValue: { status: 'ACTIVE' },
  newValue: { status: 'LOCKED', reason: 'spam', tags: ['a', 1] },
};
const EVENT = {
  id: '019b76da-a800-7d01-8000-0000000000e1',
  category: 'EXTERNAL_API_FAILURE',
  source: 'AI_SERVICE',
  operation: 'AiServiceClient.summarizeNews',
  errorType: 'com.cryptopilot.ai.AiServiceException',
  message: 'timeout',
  reference: null,
  occurrences: 4,
  firstSeenAt: '2026-11-03T05:50:00Z',
  lastSeenAt: '2026-11-03T06:00:00Z',
};
const HEALTH = {
  checkedAt: '2026-11-03T06:01:00Z',
  recentWindowMinutes: 15,
  staleAfterMinutes: 5,
  services: [
    {
      source: 'BINANCE_REST',
      status: 'DOWN',
      lastSuccessAt: null,
      lastFailureAt: '2026-11-03T06:00:00Z',
      failures24h: 3,
      lastError: '418',
      bannedUntil: '2026-11-03T07:00:00Z',
    },
  ],
  feeds: [
    {
      market: 'SPOT',
      latestCandleAt: null,
      lagSeconds: null,
      stale: true,
    },
  ],
};

function setup(answer: (url: URL) => unknown, text = false) {
  const calls: URL[] = [];
  const http = createHttpClient({
    baseUrl: 'https://api.example.test/api/v1',
    fetcher: vi.fn<typeof fetch>(async (input) => {
      const url = new URL(String(input));
      calls.push(url);
      const body = answer(url);
      return new Response(text ? String(body) : JSON.stringify(body), {
        status: 200,
      });
    }),
    session: { accessToken: () => 'token-1', refresh: async () => 'renewed' },
  });
  return { audit: createHttpAdminAuditService(http), calls };
}

describe('audit log decoders (UC-46)', () => {
  it('keeps the actor, the object and the stored values as JSON', () => {
    const page = decodeAuditLogPage({
      items: [ENTRY, { ...ENTRY, id: 'x', actor: null, entityId: null }],
      page: 1,
      pageSize: 20,
      total: 2,
    });
    expect(page.items[0]?.actor?.role).toBe('ADMIN');
    expect(page.items[0]?.newValue).toEqual({
      status: 'LOCKED',
      reason: 'spam',
      tags: ['a', 1],
    });
    expect(page.items[1]?.actor).toBe(null);
    expect(page.items[1]?.entityId).toBe(null);
  });

  it('reads the system log and the health panel, refusing unknown values', () => {
    expect(
      decodeSystemEventPage({ items: [EVENT], page: 1, pageSize: 20, total: 1 })
        .items[0]?.occurrences,
    ).toBe(4);
    expect(() =>
      decodeSystemEventPage({
        items: [{ ...EVENT, source: 'FAX' }],
        page: 1,
        pageSize: 20,
        total: 1,
      }),
    ).toThrow();
    const health = decodeSystemHealth(HEALTH);
    expect(health.services[0]?.bannedUntil).toBe('2026-11-03T07:00:00Z');
    expect(health.feeds[0]?.stale).toBe(true);
    expect(() =>
      decodeSystemHealth({
        ...HEALTH,
        services: [{ ...HEALTH.services[0], status: 'MAYBE' }],
      }),
    ).toThrow();
  });
});

describe('audit log over HTTP', () => {
  it('sends every filter, repeating action, 20 a page', async () => {
    const { audit, calls } = setup(() => ({
      items: [],
      page: 2,
      pageSize: 20,
      total: 0,
    }));
    await audit.auditLog({
      page: 2,
      actor: 'an@x',
      actorType: 'USER',
      actions: ['ACCOUNT_LOCKED', 'ACCOUNT_BANNED'],
      entityType: 'USER_ACCOUNT',
      from: '2026-11-01',
      to: '2026-11-03',
    });
    const url = calls[0] as URL;
    expect(url.pathname).toBe('/api/v1/admin/audit-log');
    expect(url.searchParams.get('pageSize')).toBe('20');
    expect(url.searchParams.get('page')).toBe('2');
    expect(url.searchParams.getAll('action')).toEqual([
      'ACCOUNT_LOCKED',
      'ACCOUNT_BANNED',
    ]);
    expect(url.searchParams.get('actorType')).toBe('USER');
    expect(url.searchParams.get('from')).toBe('2026-11-01');
    expect(url.searchParams.has('entityId')).toBe(false);
  });

  it('exports the same search as text, without paging', async () => {
    const { audit, calls } = setup(() => 'recordedAt,actorEmail\r\n', true);
    expect(await audit.exportAuditLog({ actorId: 'a1' })).toBe(
      'recordedAt,actorEmail\r\n',
    );
    expect(calls[0]?.pathname).toBe('/api/v1/admin/audit-log/export');
    expect(calls[0]?.search).toBe('?actorId=a1');
  });

  it('reads the system log by category and source, and the health', async () => {
    const { audit, calls } = setup((url) =>
      url.pathname.endsWith('health')
        ? HEALTH
        : { items: [EVENT], page: 1, pageSize: 20, total: 1 },
    );
    await audit.systemEvents({
      page: 1,
      category: 'SYSTEM_ERROR',
      source: 'MAIL',
    });
    expect(calls[0]?.searchParams.get('category')).toBe('SYSTEM_ERROR');
    expect(calls[0]?.searchParams.get('source')).toBe('MAIL');
    expect((await audit.health()).recentWindowMinutes).toBe(15);
    expect(calls[1]?.pathname).toBe('/api/v1/admin/system-health');
  });
});
