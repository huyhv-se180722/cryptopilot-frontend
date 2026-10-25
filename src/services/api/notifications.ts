import type { FeedStatus, NotificationService } from './contracts';
import { integrationPending } from './errors';
import type { HttpClient } from './http-client';
import type { AccountFeed } from './paper-trading';
import type {
  AppNotification,
  NotificationPage,
  NotificationReferenceType,
  NotificationType,
} from '../../types/domain';
import {
  flag,
  instant,
  integer,
  list,
  nullableInstant,
  oneOf,
  record,
  text,
} from './decode';

/**
 * `/notifications/**` and the `/user/queue/notifications` push (SRS 3.4.5,
 * UC-15), checked against the backend community branch @ d43b90c:
 * `NotificationResponse`, `UnreadCountResponse`; the SYSTEM type and the
 * NEWS_SOURCE reference against `develop` @ 103d7cf.
 */
const TYPES: readonly NotificationType[] = [
  'ALERT',
  'PLAN',
  'MODERATION',
  'SUBSCRIPTION',
  'COMMENT',
  'SYSTEM',
];
const REFERENCES: readonly NotificationReferenceType[] = [
  'ALERT',
  'PLAN',
  'POST',
  'SUBSCRIPTION',
  'NEWS_SOURCE',
];
export const NOTIFICATION_QUEUE = '/user/queue/notifications';

export function decodeNotification(body: unknown): AppNotification {
  const value = record(body, 'notification');
  const referenceType = value.referenceType;
  const referenceId = value.referenceId;
  return {
    id: text(value.id, 'id'),
    type: oneOf(TYPES, value.type, 'type'),
    title: text(value.title, 'title'),
    content: typeof value.content === 'string' ? value.content : '',
    // A reference needs both halves; either alone opens nothing.
    reference:
      referenceType === null ||
      referenceType === undefined ||
      referenceId === null ||
      referenceId === undefined
        ? null
        : {
            type: oneOf(REFERENCES, referenceType, 'referenceType'),
            id: text(referenceId, 'referenceId'),
          },
    read: flag(value.read, 'read'),
    readAt: nullableInstant(value.readAt, 'readAt'),
    createdAt: instant(value.createdAt, 'createdAt'),
  };
}

export function decodeNotificationPage(body: unknown): NotificationPage {
  const value = record(body);
  return {
    items: list(value.items, 'items').map(decodeNotification),
    page: integer(value.page, 'page'),
    pageSize: integer(value.pageSize, 'pageSize'),
    total: integer(value.total, 'total'),
  };
}

export function decodeUnreadCount(body: unknown): number {
  const unread = integer(record(body).unread, 'unread');
  if (unread < 0) throw new Error('unread must not be negative');
  return unread;
}

/** Used while no API base URL is configured. */
export function createPendingNotificationService(): NotificationService {
  return {
    list: async () => integrationPending(),
    unreadCount: async () => integrationPending(),
    markRead: async () => integrationPending(),
    markAllRead: async () => integrationPending(),
    subscribe: () => () => undefined,
    feedStatus: (): FeedStatus => 'unavailable',
    onFeedStatus: () => () => undefined,
  };
}

/**
 * The REST calls with the bearer token; new notifications arrive on the
 * signed-in STOMP connection when there is one (TD 9).
 */
export function createHttpNotificationService(
  http: HttpClient,
  feed: AccountFeed | null = null,
): NotificationService {
  const withSignal = (signal?: AbortSignal) => (signal ? { signal } : {});
  return {
    list: ({ unreadOnly, page, pageSize }, signal) =>
      http.request({
        path:
          'notifications?' +
          new URLSearchParams({
            unreadOnly: String(unreadOnly),
            page: String(page),
            pageSize: String(pageSize),
          }).toString(),
        decode: decodeNotificationPage,
        ...withSignal(signal),
      }),
    unreadCount: (signal) =>
      http.request({
        path: 'notifications/unread-count',
        decode: decodeUnreadCount,
        ...withSignal(signal),
      }),
    markRead: (id) =>
      http.request({
        path: 'notifications/' + encodeURIComponent(id) + '/read',
        method: 'POST',
        decode: decodeNotification,
      }),
    markAllRead: () =>
      http.request({
        path: 'notifications/read-all',
        method: 'POST',
        decode: decodeUnreadCount,
      }),
    subscribe: (listener) =>
      feed
        ? feed.subscribeTopic(NOTIFICATION_QUEUE, decodeNotification, listener)
        : () => undefined,
    feedStatus: () => (feed ? feed.status() : 'unavailable'),
    onFeedStatus: (listener) =>
      feed ? feed.onStatus(listener) : () => undefined,
  };
}
