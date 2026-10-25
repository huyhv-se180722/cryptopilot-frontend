// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NotificationsPage } from '../../pages/trader/NotificationsPage';
import type { NotificationService } from '../../services/api/contracts';
import {
  createPendingNotificationService,
  decodeNotification,
} from '../../services/api/notifications';
import { en } from '../../i18n/locales/en';
import type { AppNotification } from '../../types/domain';
import { fakeAuth, page, renderRoutes, testTrader } from '../../test/render';
import { notificationText } from './components/notification-text';

const PLAN_ID = '0199a2c4-0000-7000-8000-000000000015';
const note = (over: Partial<AppNotification>): AppNotification => ({
  id: 'n1',
  type: 'PLAN',
  title: 'Server title',
  content: 'Server text.',
  reference: { type: 'PLAN', id: PLAN_ID },
  read: false,
  readAt: null,
  createdAt: new Date().toISOString(),
  ...over,
});

describe('plan notices (MSG23, MSG24, MSG53, MSG54)', () => {
  it.each([
    [
      'MSG23',
      ['BTCUSDT', 'TAKE_PROFIT', '63000.000000000000', '29.87700000'],
      'Position closed',
      'BTC/USDT position closed by take profit at 63,000.00. P/L: +29.88.',
    ],
    [
      'MSG23',
      ['ETHUSDT', 'STOP_LOSS', '2449.75', '-11.03995000'],
      'Position closed',
      'ETH/USDT position closed by stop loss at 2,449.75. P/L: -11.04.',
    ],
    [
      'MSG23',
      ['BTCUSDT', 'MANUAL', '62500.0', '4.5415'],
      'Position closed',
      'BTC/USDT position closed by you at 62,500.00. P/L: +4.54.',
    ],
    [
      'MSG24',
      ['SOLUSDT', '90.370000000000', '-20.02296000'],
      'Position liquidated',
      'SOL/USDT position was liquidated at 90.37. Loss: -20.02.',
    ],
    [
      'MSG53',
      ['SOLUSDT'],
      'Plan expired',
      'Your SOL/USDT plan expired before its entry filled.',
    ],
    [
      'MSG54',
      ['SOLUSDT', 'TAKE_PROFIT_REACHED'],
      'Plan invalidated',
      'Your SOL/USDT plan was invalidated: the take profit was reached first.',
    ],
    [
      'MSG54',
      ['ETHUSDT', 'INVALIDATION_PRICE'],
      'Plan invalidated',
      'Your ETH/USDT plan was invalidated: the invalidation price was reached.',
    ],
  ])('words %s %j', (code, args, title, content) => {
    expect(notificationText(en, note({ message: { code, args } }))).toEqual({
      title,
      content,
    });
  });

  it('keeps the server’s words without a message, or for another one', () => {
    expect(notificationText(en, note({}))).toEqual({
      title: 'Server title',
      content: 'Server text.',
    });
    expect(
      notificationText(en, note({ message: { code: 'MSG28', args: ['x'] } })),
    ).toEqual({ title: 'Server title', content: 'Server text.' });
  });

  it('reads messageCode and messageArgs only when both are well formed', () => {
    const body = {
      id: 'n1',
      type: 'PLAN',
      title: 'Position closed',
      content: 'text',
      referenceType: 'PLAN',
      referenceId: PLAN_ID,
      read: false,
      readAt: null,
      createdAt: '2026-10-25T08:00:00Z',
    };
    expect(decodeNotification(body)).not.toHaveProperty('message');
    expect(
      decodeNotification({
        ...body,
        messageCode: 'MSG24',
        messageArgs: ['SOLUSDT', '90.37', '-20.02'],
      }).message,
    ).toEqual({ code: 'MSG24', args: ['SOLUSDT', '90.37', '-20.02'] });
    expect(
      decodeNotification({ ...body, messageCode: 'MSG24', messageArgs: [1] }),
    ).not.toHaveProperty('message');
    expect(
      decodeNotification({ ...body, messageCode: 'oops', messageArgs: [] }),
    ).not.toHaveProperty('message');
  });

  it('lists each notice in its words and opens its plan', async () => {
    const items = [
      note({
        id: 'n23',
        message: {
          code: 'MSG23',
          args: ['BTCUSDT', 'TAKE_PROFIT', '63000', '29.877'],
        },
      }),
      note({
        id: 'n24',
        message: { code: 'MSG24', args: ['SOLUSDT', '90.37', '-20.02296'] },
      }),
      note({ id: 'n53', message: { code: 'MSG53', args: ['SOLUSDT'] } }),
      note({
        id: 'n54',
        message: { code: 'MSG54', args: ['SOLUSDT', 'STOP_LOSS_REACHED'] },
      }),
    ];
    const notifications: NotificationService = {
      ...createPendingNotificationService(),
      unreadCount: async () => items.length,
      list: async () => ({ items, page: 1, pageSize: 20, total: items.length }),
      markRead: async (id) => ({
        ...(items.find((n) => n.id === id) as AppNotification),
        read: true,
      }),
    };
    await renderRoutes(
      [
        page('/notifications', <NotificationsPage />),
        page('/plans/:planId', <p>plan page</p>),
      ],
      '/notifications',
      fakeAuth({ restoreSession: async () => testTrader }),
      { notifications },
    );
    expect(
      await screen.findByText(/closed by take profit at 63,000.00/),
    ).toBeTruthy();
    expect(screen.getByText(/liquidated at 90.37. Loss: -20.02/)).toBeTruthy();
    expect(
      screen.getByText(/plan expired before its entry filled/),
    ).toBeTruthy();
    expect(
      screen.getByText(/invalidated: the stop loss was reached first/),
    ).toBeTruthy();
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: /Position liquidated/ }));
    await waitFor(() => expect(screen.getByText('plan page')).toBeTruthy());
  });
});
