import { useState } from 'react';
import { BellOff, CheckCheck } from 'lucide-react';
import { EmptyState, ErrorState } from '../../components/feedback/States';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Skeleton } from '../../components/ui/Skeleton';
import { Tabs } from '../../components/ui/Tabs';
import { NotificationItem } from '../../features/notifications/components/NotificationItem';
import { useOpenNotification } from '../../features/notifications/components/use-open-notification';
import {
  useMarkAllRead,
  useNotificationList,
  useUnreadCount,
} from '../../features/notifications/hooks/use-notifications';
import { useCopy } from '../../hooks/use-copy';
import { useToast } from '../../hooks/use-toast';
import { errorText } from '../../i18n/messages';

type View = 'all' | 'unread';

/**
 * SCR-15 Notification center (SRS 3.4.5, UC-15): newest first with type,
 * title, time and read status; all or unread; opening one marks it read
 * and goes to the alert, plan, post or subscription it references; mark
 * all as read. Delivery by email and push is NSF-15, not this screen.
 */
export function NotificationsPage() {
  const copy = useCopy();
  const n = copy.notifications;
  const { show } = useToast();
  const [view, setView] = useState<View>('all');
  const list = useNotificationList(view === 'unread');
  const count = useUnreadCount();
  const markAll = useMarkAllRead();
  const open = useOpenNotification();
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];

  async function readAll() {
    const result = await markAll.run();
    if (result.status === 'success')
      show({ tone: 'success', message: n.allRead });
    else if (result.status === 'error')
      show({ tone: 'error', message: errorText(copy, result.error) });
  }

  const body = list.isPending ? (
    <div className="grid gap-2 p-3">
      {[0, 1, 2, 3].map((k) => (
        <Skeleton key={k} className="h-14 w-full" />
      ))}
    </div>
  ) : list.isError ? (
    <ErrorState
      message={errorText(copy, list.error)}
      onRetry={() => void list.refetch()}
    />
  ) : items.length === 0 ? (
    <EmptyState
      icon={BellOff}
      title={view === 'unread' ? n.emptyUnread : n.empty}
      {...(view === 'all' ? { description: n.emptyHint } : {})}
    />
  ) : (
    <ul className="divide-y divide-line p-1.5">
      {items.map((item) => (
        <li key={item.id} className="py-0.5">
          <NotificationItem notification={item} onOpen={open} />
        </li>
      ))}
    </ul>
  );

  const panel = (
    <Card padding="none">
      {body}
      {list.hasNextPage && (
        <div className="flex justify-center border-t border-line p-3">
          <Button
            variant="secondary"
            size="sm"
            disabled={list.isFetchingNextPage}
            onClick={() => void list.fetchNextPage()}
          >
            {n.loadMore}
          </Button>
        </div>
      )}
    </Card>
  );

  const unread = count.data;
  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader
        title={n.title}
        description={n.subtitle}
        actions={
          <Button
            variant="secondary"
            disabled={markAll.pending || unread === 0 || items.length === 0}
            onClick={() => void readAll()}
          >
            <CheckCheck size={14} aria-hidden="true" />
            {n.markAllRead}
          </Button>
        }
      />
      <Tabs
        label={n.tabsLabel}
        value={view}
        onChange={(id) => setView(id as View)}
        items={[
          { id: 'all', label: n.tabAll, panel: view === 'all' && panel },
          {
            id: 'unread',
            label: n.tabUnread,
            ...(unread !== undefined ? { count: unread } : {}),
            panel: view === 'unread' && panel,
          },
        ]}
      />
    </div>
  );
}
