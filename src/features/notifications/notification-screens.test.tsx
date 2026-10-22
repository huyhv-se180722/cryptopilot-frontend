// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NotificationsPage } from '../../pages/trader/NotificationsPage';
import type { NotificationService } from '../../services/api/contracts';
import { createPendingNotificationService } from '../../services/api/notifications';
import type { AppNotification } from '../../types/domain';
import { fakeAuth, page, renderRoutes, testTrader } from '../../test/render';
import { NotificationBell } from './components/NotificationBell';

const signedIn = fakeAuth({ restoreSession: async () => testTrader });

const note = (over: Partial<AppNotification>): AppNotification => ({
  id: 'n1',
  type: 'PLAN',
  title: 'Trading plan expired',
  content: 'Your SOL/USDT plan expired.',
  reference: null,
  read: false,
  readAt: null,
  createdAt: new Date().toISOString(),
  ...over,
});

describe('notification screens', () => {
  it('says the feature is not connected while the backend API is pending', async () => {
    await renderRoutes(
      [page('/notifications', <NotificationsPage />)],
      '/notifications',
      signedIn,
    );
    expect(
      await screen.findByText(
        'This feature is not connected to the server yet. Please try again later.',
      ),
    ).toBeTruthy();
  });

  it('reads the bell again when a notification is pushed', async () => {
    let unread = 1;
    let push: ((n: AppNotification) => void) | null = null;
    const notifications: NotificationService = {
      ...createPendingNotificationService(),
      unreadCount: async () => unread,
      subscribe: (listener) => {
        push = listener;
        return () => {
          push = null;
        };
      },
    };
    await renderRoutes([page('/', <NotificationBell />)], '/', signedIn, {
      notifications,
    });
    expect(
      await screen.findByRole('button', { name: 'Notifications, 1 unread' }),
    ).toBeTruthy();
    unread = 2;
    act(() => push?.(note({ id: 'n2' })));
    expect(
      await screen.findByRole('button', { name: 'Notifications, 2 unread' }),
    ).toBeTruthy();
  });

  it('marks a notification without a reference read and stays on the page', async () => {
    const user = userEvent.setup();
    const read: string[] = [];
    let current = note({});
    const notifications: NotificationService = {
      ...createPendingNotificationService(),
      unreadCount: async () => (current.read ? 0 : 1),
      list: async () => ({
        items: [current],
        page: 1,
        pageSize: 20,
        total: 1,
      }),
      markRead: async (id) => {
        read.push(id);
        current = { ...current, read: true, readAt: new Date().toISOString() };
        return current;
      },
    };
    await renderRoutes(
      [page('/notifications', <NotificationsPage />)],
      '/notifications',
      signedIn,
      { notifications },
    );
    await user.click(
      await screen.findByRole('button', { name: /Trading plan expired/ }),
    );
    await waitFor(() => expect(read).toEqual(['n1']));
    expect(
      await screen.findByRole('heading', { name: 'Notifications' }),
    ).toBeTruthy();
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /Trading plan expired/ })
          .textContent,
      ).not.toContain('Unread'),
    );
  });
});
