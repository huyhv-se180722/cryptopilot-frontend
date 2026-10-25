import { describe, expect, it, vi } from 'vitest';
import type { AppNotification } from '../../types/domain';
import { createHttpClient } from './http-client';
import {
  NOTIFICATION_QUEUE,
  createHttpNotificationService,
  createPendingNotificationService,
  decodeNotification,
  decodeUnreadCount,
} from './notifications';
import type { AccountFeed } from './paper-trading';

/** `NotificationResponse` of the backend community branch @ d43b90c. */
const ROW = {
  id: '0199c000-0000-7000-8000-000000000001',
  type: 'COMMENT',
  title: 'New comment on your post',
  content: 'Lan Pham commented on "BTC holds the weekly support".',
  referenceType: 'POST',
  referenceId: '0199b100-0000-7000-8000-000000000001',
  read: false,
  readAt: null,
  createdAt: '2026-10-22T03:00:00Z',
};

function setup(reply: unknown, feed: AccountFeed | null = null) {
  const calls: { url: URL; method: string }[] = [];
  const http = createHttpClient({
    baseUrl: 'https://api.example.test/api/v1',
    fetcher: vi.fn<typeof fetch>(async (input, init = {}) => {
      calls.push({ url: new URL(String(input)), method: init.method ?? 'GET' });
      return new Response(JSON.stringify(reply), { status: 200 });
    }),
    session: { accessToken: () => 'token-1', refresh: async () => 'renewed' },
  });
  return { service: createHttpNotificationService(http, feed), calls };
}

describe('notification decoders', () => {
  it('decodes a notification with what it opens', () => {
    expect(decodeNotification(ROW)).toMatchObject({
      type: 'COMMENT',
      reference: { type: 'POST', id: ROW.referenceId },
      read: false,
    });
  });

  it('decodes the SYSTEM notice of a failing news source (develop @ 103d7cf)', () => {
    expect(
      decodeNotification({
        ...ROW,
        type: 'SYSTEM',
        title: 'A news source keeps failing',
        referenceType: 'NEWS_SOURCE',
      }),
    ).toMatchObject({
      type: 'SYSTEM',
      reference: { type: 'NEWS_SOURCE', id: ROW.referenceId },
    });
  });

  it('opens nothing without both halves of the reference', () => {
    expect(
      decodeNotification({ ...ROW, referenceType: null, referenceId: null })
        .reference,
    ).toBeNull();
    expect(
      decodeNotification({ ...ROW, referenceId: null }).reference,
    ).toBeNull();
  });

  it('refuses an unknown type and a negative count', () => {
    expect(() => decodeNotification({ ...ROW, type: 'NEWS' })).toThrow();
    expect(() => decodeUnreadCount({ unread: -1 })).toThrow();
    expect(decodeUnreadCount({ unread: 3 })).toBe(3);
  });
});

describe('HTTP notification adapter', () => {
  it('lists a page, unread only when asked', async () => {
    const { service, calls } = setup({
      items: [ROW],
      page: 1,
      pageSize: 20,
      total: 1,
    });
    const page = await service.list({
      unreadOnly: true,
      page: 1,
      pageSize: 20,
    });
    expect(page.items).toHaveLength(1);
    expect(calls[0]?.url.pathname).toBe('/api/v1/notifications');
    expect(Object.fromEntries(calls[0]?.url.searchParams ?? [])).toEqual({
      unreadOnly: 'true',
      page: '1',
      pageSize: '20',
    });
  });

  it('marks one and all read with POST', async () => {
    const one = setup({ ...ROW, read: true, readAt: '2026-10-22T04:00:00Z' });
    expect((await one.service.markRead(ROW.id)).read).toBe(true);
    expect(one.calls[0]).toMatchObject({ method: 'POST' });
    expect(one.calls[0]?.url.pathname).toBe(
      '/api/v1/notifications/' + ROW.id + '/read',
    );
    const all = setup({ unread: 0 });
    expect(await all.service.markAllRead()).toBe(0);
    expect(all.calls[0]?.url.pathname).toBe('/api/v1/notifications/read-all');
  });

  it('listens to the user queue on the signed-in feed', () => {
    const subscribed: string[] = [];
    const feed: AccountFeed = {
      status: () => 'open',
      onStatus: () => () => undefined,
      subscribeTopic: (destination, decode, listener) => {
        subscribed.push(destination);
        listener(decode(ROW));
        return () => undefined;
      },
    };
    const received: AppNotification[] = [];
    setup({}, feed).service.subscribe((n) => received.push(n));
    expect(subscribed).toEqual([NOTIFICATION_QUEUE]);
    expect(received[0]?.id).toBe(ROW.id);
  });

  it('answers NOT_CONFIGURED while no API is configured', async () => {
    const pending = createPendingNotificationService();
    await expect(pending.unreadCount()).rejects.toMatchObject({
      code: 'NOT_CONFIGURED',
    });
    expect(pending.feedStatus()).toBe('unavailable');
  });
});
