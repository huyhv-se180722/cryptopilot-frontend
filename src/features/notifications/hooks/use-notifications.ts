import { useCallback, useEffect, useSyncExternalStore } from 'react';
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query';
import { useMutation } from '../../../hooks/use-mutation';
import { useServices } from '../../../hooks/use-services';
import type { AppNotification, NotificationPage } from '../../../types/domain';

export const NOTIFICATIONS_KEY = ['notifications'] as const;
const COUNT_KEY = [...NOTIFICATIONS_KEY, 'unread-count'] as const;
const PAGE_SIZE = 20;
/** Without pushes the bell reads the count this often (TD 9 fallback). */
const COUNT_EVERY_MS = 60_000;

/** True while new notifications arrive on the signed-in connection. */
function usePushesOpen() {
  const { notifications } = useServices();
  return (
    useSyncExternalStore(
      notifications.onFeedStatus,
      notifications.feedStatus,
      notifications.feedStatus,
    ) === 'open'
  );
}

/** The number on the bell (SRS 3.4.5). */
export function useUnreadCount() {
  const { notifications } = useServices();
  const pushes = usePushesOpen();
  return useQuery({
    queryKey: COUNT_KEY,
    queryFn: ({ signal }) => notifications.unreadCount(signal),
    refetchInterval: pushes ? false : COUNT_EVERY_MS,
  });
}

/**
 * Listens for new notifications while the Trader shell is open and reads
 * the bell and the lists again when one arrives.
 */
export function useNotificationPushes() {
  const { notifications } = useServices();
  const client = useQueryClient();
  useEffect(
    () =>
      notifications.subscribe(() => {
        void client.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
      }),
    [notifications, client],
  );
}

/** SCR-15: all or unread notifications, newest first, a page at a time. */
export function useNotificationList(unreadOnly: boolean) {
  const { notifications } = useServices();
  return useInfiniteQuery({
    queryKey: [...NOTIFICATIONS_KEY, 'list', unreadOnly],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      notifications.list(
        { unreadOnly, page: pageParam, pageSize: PAGE_SIZE },
        signal,
      ),
    getNextPageParam: (last) =>
      last.page * last.pageSize < last.total ? last.page + 1 : undefined,
  });
}

/** The newest few, for the bell menu and the dashboard block. */
export function useLatestNotifications(count: number) {
  const { notifications } = useServices();
  return useQuery({
    queryKey: [...NOTIFICATIONS_KEY, 'latest', count],
    queryFn: ({ signal }) =>
      notifications.list(
        { unreadOnly: false, page: 1, pageSize: count },
        signal,
      ),
  });
}

/** Writes `change` into every cached copy of the notifications. */
function patchCached(
  client: QueryClient,
  change: (n: AppNotification) => AppNotification,
) {
  client.setQueriesData<InfiniteData<NotificationPage>>(
    { queryKey: [...NOTIFICATIONS_KEY, 'list'] },
    (data) =>
      data && {
        ...data,
        pages: data.pages.map((p) => ({ ...p, items: p.items.map(change) })),
      },
  );
  client.setQueriesData<NotificationPage>(
    { queryKey: [...NOTIFICATIONS_KEY, 'latest'] },
    (data) => data && { ...data, items: data.items.map(change) },
  );
}

/**
 * Opening a notification marks it read (SRS 3.4.5). The server's answer
 * replaces the cached copies; the bell and the Unread tab read again.
 */
export function useMarkRead() {
  const { notifications } = useServices();
  const client = useQueryClient();
  return useMutation(
    useCallback(
      async (id: string) => {
        const read = await notifications.markRead(id);
        patchCached(client, (n) => (n.id === id ? read : n));
        await Promise.all([
          client.invalidateQueries({ queryKey: COUNT_KEY }),
          client.invalidateQueries({
            queryKey: [...NOTIFICATIONS_KEY, 'list', true],
          }),
        ]);
        return read;
      },
      [notifications, client],
    ),
  );
}

export function useMarkAllRead() {
  const { notifications } = useServices();
  const client = useQueryClient();
  return useMutation(
    useCallback(async () => {
      const unread = await notifications.markAllRead();
      client.setQueryData(COUNT_KEY, unread);
      await client.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
      return unread;
    }, [notifications, client]),
  );
}
