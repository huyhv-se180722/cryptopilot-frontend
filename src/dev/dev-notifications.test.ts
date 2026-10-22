import { describe, expect, it } from 'vitest';
import type { Session } from '../types/domain';
import { createDevelopmentNotifications } from './dev-notifications';
import { devPrincipals } from './fixtures/auth';

const trader = devPrincipals.find((p) => p.user.id === 'dev-free') as Session;

describe('development notifications', () => {
  it('lists newest first and only the unread ones on request', async () => {
    const { notifications } = createDevelopmentNotifications(
      async () => trader,
    );
    const all = await notifications.list({
      unreadOnly: false,
      page: 1,
      pageSize: 20,
    });
    const times = all.items.map((n) => Date.parse(n.createdAt));
    expect([...times].sort((a, b) => b - a)).toEqual(times);
    const unread = await notifications.list({
      unreadOnly: true,
      page: 1,
      pageSize: 20,
    });
    expect(unread.items.every((n) => !n.read)).toBe(true);
    expect(await notifications.unreadCount()).toBe(unread.total);
  });

  it('marks one, then all read', async () => {
    const { notifications } = createDevelopmentNotifications(
      async () => trader,
    );
    const before = await notifications.unreadCount();
    const first = (
      await notifications.list({ unreadOnly: true, page: 1, pageSize: 1 })
    ).items[0];
    expect((await notifications.markRead(first?.id ?? '')).read).toBe(true);
    expect(await notifications.unreadCount()).toBe(before - 1);
    expect(await notifications.markAllRead()).toBe(0);
    expect(await notifications.unreadCount()).toBe(0);
  });

  it('answers MSG44 without a Trader', async () => {
    const { notifications } = createDevelopmentNotifications(async () => null);
    await expect(notifications.unreadCount()).rejects.toMatchObject({
      status: 401,
    });
  });
});
