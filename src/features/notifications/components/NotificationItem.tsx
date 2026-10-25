import {
  Bell,
  CreditCard,
  FileText,
  MessageSquare,
  ServerCrash,
  ShieldAlert,
  type LucideIcon,
} from 'lucide-react';
import { useCopy } from '../../../hooks/use-copy';
import type { AppNotification, NotificationType } from '../../../types/domain';
import { classNames } from '../../../utils/class-names';
import { formatInstantUtc } from '../../../utils/instant-format';
import { notificationAge } from './notification-format';

const icons: Record<NotificationType, LucideIcon> = {
  ALERT: Bell,
  PLAN: FileText,
  MODERATION: ShieldAlert,
  SUBSCRIPTION: CreditCard,
  COMMENT: MessageSquare,
  SYSTEM: ServerCrash,
};
const tones: Record<NotificationType, string> = {
  ALERT: 'bg-warning-soft text-warning',
  PLAN: 'bg-primary-soft text-primary',
  MODERATION: 'bg-negative-soft text-negative',
  SUBSCRIPTION: 'bg-accent-soft text-accent',
  COMMENT: 'bg-positive-soft text-positive',
  SYSTEM: 'bg-warning-soft text-warning',
};

/**
 * One notification (SCR-15): icon by type, title, text, age and an unread
 * dot (never colour alone: the row also says "Unread" to screen readers).
 * Clicking opens it (marks it read and follows its reference).
 */
export function NotificationItem({
  notification,
  onOpen,
  compact = false,
}: {
  notification: AppNotification;
  onOpen: (notification: AppNotification) => void;
  compact?: boolean;
}) {
  const copy = useCopy();
  const n = copy.notifications;
  const Icon = icons[notification.type];
  return (
    <button
      type="button"
      onClick={() => onOpen(notification)}
      className={classNames(
        'flex w-full items-start gap-3 rounded-lg text-left hover:bg-raised focus-visible:bg-raised',
        compact ? 'px-3 py-2.5' : 'px-3 py-3 sm:px-4',
        !notification.read && 'bg-primary-soft/40',
      )}
    >
      <span
        aria-hidden="true"
        className={classNames(
          'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg',
          tones[notification.type],
        )}
      >
        <Icon size={14} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span
            className={classNames(
              'min-w-0 flex-1 truncate text-xs',
              notification.read
                ? 'font-medium text-fg-2'
                : 'font-semibold text-fg',
            )}
          >
            {notification.title}
          </span>
          <time
            dateTime={notification.createdAt}
            title={formatInstantUtc(notification.createdAt)}
            className="shrink-0 text-[11px] text-muted-x"
          >
            {notificationAge(copy, notification.createdAt)}
          </time>
        </span>
        {notification.content && (
          <span
            className={classNames(
              'mt-0.5 text-[11px] leading-relaxed text-muted-dim',
              compact ? 'line-clamp-1' : 'line-clamp-2',
            )}
          >
            {notification.content}
          </span>
        )}
        <span className="mt-1 block text-[10px] font-semibold tracking-wider text-muted-x uppercase">
          {n[`type${notification.type}`]}
        </span>
      </span>
      {!notification.read && (
        <span className="mt-2 flex shrink-0 items-center">
          <span aria-hidden="true" className="size-2 rounded-full bg-primary" />
          <span className="sr-only">{n.unread}</span>
        </span>
      )}
    </button>
  );
}
