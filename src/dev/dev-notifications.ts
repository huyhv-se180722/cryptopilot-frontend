import type {
  FeedStatus,
  NotificationService,
} from '../services/api/contracts';
import { ServiceError } from '../services/api/errors';
import type { AppNotification, Session } from '../types/domain';

/**
 * DEVELOPMENT ONLY. An in-memory notification center with the backend's
 * answers: newest first, unread only on request, page and pageSize checks
 * (MSG15), marking one read keeps its first read time, MSG41 for another
 * id, MSG44 without a Trader. One scripted notification is pushed 20 s
 * after the first listener, to show the bell move. Texts are written for
 * the fixtures; references point at the development alert, plan and post
 * ids. A reload restores the fixture.
 */
function refuse(
  status: number,
  code: string,
  messageCode: string,
  fieldErrors: Readonly<Record<string, string>> = {},
): never {
  throw new ServiceError(
    'Development notification refusal.',
    'HTTP_ERROR',
    status,
    { status, code, messageCode, messageArgs: [], fieldErrors },
  );
}

const pause = (signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, 150);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(signal.reason);
    });
  });

const MINUTE = 60_000;
const PUSH_AFTER_MS = 20_000;

type Seed = Omit<AppNotification, 'id' | 'readAt' | 'createdAt'> & {
  minutesAgo: number;
};

const SEEDS: readonly Seed[] = [
  {
    type: 'ALERT',
    title: 'BTC/USDT alert triggered (fixture)',
    content: 'BTC/USDT: crosses above 65,000 (65,012.40).',
    reference: { type: 'ALERT', id: '0199a3d4-0000-7000-8000-000000000001' },
    read: false,
    minutesAgo: 4,
  },
  {
    type: 'COMMENT',
    title: 'New comment on your post (fixture)',
    content:
      'Lan Pham commented on "My first plan with a fixed risk per trade".',
    reference: { type: 'POST', id: 'dev-post-mine-1' },
    read: false,
    minutesAgo: 35,
  },
  {
    type: 'PLAN',
    title: 'Trading plan executed (fixture)',
    content: 'Your ETH/USDT plan reached its entry and is now executed.',
    reference: { type: 'PLAN', id: '0199a2c4-0000-7000-8000-000000000001' },
    read: false,
    minutesAgo: 180,
  },
  {
    type: 'MODERATION',
    title: 'Your post was hidden (fixture)',
    content:
      'An administrator hid "Hidden after a report" after a report. Only you can still see it.',
    reference: { type: 'POST', id: 'dev-post-mine-hidden' },
    read: true,
    minutesAgo: 60 * 26,
  },
  {
    type: 'SUBSCRIPTION',
    title: 'Subscription renews soon (fixture)',
    content: 'Your plan renews in 3 days.',
    reference: { type: 'SUBSCRIPTION', id: 'dev-subscription-1' },
    read: true,
    minutesAgo: 60 * 24 * 3,
  },
  {
    type: 'PLAN',
    title: 'Trading plan expired (fixture)',
    content: 'Your SOL/USDT plan expired before its entry was reached.',
    reference: null,
    read: true,
    minutesAgo: 60 * 24 * 6,
  },
];

export function createDevelopmentNotifications(
  session: () => Promise<Session | null>,
): { notifications: NotificationService } {
  const built = Date.now();
  let items: AppNotification[] = SEEDS.map((seed, index) => {
    const { minutesAgo, ...rest } = seed;
    const createdAt = new Date(built - minutesAgo * MINUTE).toISOString();
    return {
      ...rest,
      id: 'dev-notification-' + String(index + 1),
      createdAt,
      readAt: rest.read ? createdAt : null,
    };
  });
  const listeners = new Set<(n: AppNotification) => void>();
  let pushed = false;

  async function trader() {
    const current = await session();
    if (!current || current.user.role !== 'Trader')
      refuse(401, 'AUTHENTICATION_REQUIRED', 'MSG44');
  }
  const unread = () => items.filter((n) => !n.read).length;

  function schedulePush() {
    if (pushed) return;
    pushed = true;
    setTimeout(() => {
      const fresh: AppNotification = {
        id: 'dev-notification-push',
        type: 'ALERT',
        title: 'ETH/USDT alert triggered (fixture push)',
        content: 'ETH/USDT: crosses below 2,400 (2,398.10).',
        reference: {
          type: 'ALERT',
          id: '0199a3d4-0000-7000-8000-000000000002',
        },
        read: false,
        readAt: null,
        createdAt: new Date().toISOString(),
      };
      items = [fresh, ...items];
      for (const listener of listeners) listener(fresh);
    }, PUSH_AFTER_MS);
  }

  const notifications: NotificationService = {
    async list({ unreadOnly, page, pageSize }, signal) {
      await pause(signal);
      await trader();
      if (page < 1)
        refuse(400, 'VALIDATION_FAILED', 'MSG01', { page: 'MSG15' });
      if (pageSize < 1 || pageSize > 100)
        refuse(400, 'VALIDATION_FAILED', 'MSG01', { pageSize: 'MSG15' });
      const found = items
        .filter((n) => !unreadOnly || !n.read)
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
      const start = (page - 1) * pageSize;
      return {
        items: found.slice(start, start + pageSize),
        page,
        pageSize,
        total: found.length,
      };
    },
    async unreadCount(signal) {
      await pause(signal);
      await trader();
      return unread();
    },
    async markRead(id) {
      await pause();
      await trader();
      const found = items.find((n) => n.id === id);
      if (!found) return refuse(404, 'RESOURCE_NOT_FOUND', 'MSG41');
      if (found.read) return found;
      const read = { ...found, read: true, readAt: new Date().toISOString() };
      items = items.map((n) => (n.id === id ? read : n));
      return read;
    },
    async markAllRead() {
      await pause();
      await trader();
      const now = new Date().toISOString();
      items = items.map((n) =>
        n.read ? n : { ...n, read: true, readAt: now },
      );
      return 0;
    },
    subscribe(listener) {
      listeners.add(listener);
      schedulePush();
      return () => listeners.delete(listener);
    },
    // Development data has no socket: the bell reads on its rhythm too.
    feedStatus: (): FeedStatus => 'unavailable',
    onFeedStatus: () => () => undefined,
  };
  return { notifications };
}
