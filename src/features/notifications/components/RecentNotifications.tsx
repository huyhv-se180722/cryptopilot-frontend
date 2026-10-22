import { Skeleton } from '../../../components/ui/Skeleton';
import { useCopy } from '../../../hooks/use-copy';
import { errorText } from '../../../i18n/messages';
import { useLatestNotifications } from '../hooks/use-notifications';
import { NotificationItem } from './NotificationItem';
import { useOpenNotification } from './use-open-notification';

const COUNT = 5;
const message =
  'flex flex-1 items-center justify-center px-4 py-8 text-center text-xs text-muted-dim';

/** The "Recent notifications" block of SCR-08: the newest five. */
export function RecentNotifications() {
  const copy = useCopy();
  const latest = useLatestNotifications(COUNT);
  const open = useOpenNotification();
  if (latest.isPending)
    return (
      <div className="grid gap-2 p-3">
        {[0, 1, 2].map((k) => (
          <Skeleton key={k} className="h-10 w-full" />
        ))}
      </div>
    );
  if (latest.isError)
    return <p className={message}>{errorText(copy, latest.error)}</p>;
  if (latest.data.items.length === 0)
    return <p className={message}>{copy.notifications.empty}</p>;
  return (
    <ul className="p-1">
      {latest.data.items.map((item) => (
        <li key={item.id}>
          <NotificationItem notification={item} onOpen={open} compact />
        </li>
      ))}
    </ul>
  );
}
