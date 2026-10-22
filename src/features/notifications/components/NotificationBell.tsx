import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { BellRing, CheckCheck } from 'lucide-react';
import { Skeleton } from '../../../components/ui/Skeleton';
import { useCopy } from '../../../hooks/use-copy';
import { useToast } from '../../../hooks/use-toast';
import { formatCopy } from '../../../i18n/copy';
import { errorText } from '../../../i18n/messages';
import { classNames } from '../../../utils/class-names';
import {
  useLatestNotifications,
  useMarkAllRead,
  useNotificationPushes,
  useUnreadCount,
} from '../hooks/use-notifications';
import { badgeText } from './notification-format';
import { NotificationItem } from './NotificationItem';
import { useOpenNotification } from './use-open-notification';

const LATEST = 8;

/**
 * The header bell (SRS 3.4.5): the unread count as a badge (99+), and a
 * drawer with the newest notifications, Mark all as read and View all
 * (SCR-15). It also keeps the bell listening for pushes while the Trader
 * shell is open.
 */
export function NotificationBell() {
  const copy = useCopy();
  const n = copy.notifications;
  useNotificationPushes();
  const count = useUnreadCount();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  // A failed count shows no badge; the page reports the error.
  const unread = count.data ?? 0;

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const label = unread > 0 ? formatCopy(n.bellUnread, { n: unread }) : n.bell;

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        title={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((value) => !value)}
        className={classNames(
          'relative inline-flex size-8 shrink-0 items-center justify-center rounded-lg pointer-coarse:size-11',
          open
            ? 'bg-raised text-primary'
            : 'text-muted-dim hover:bg-raised hover:text-fg-2',
        )}
      >
        <BellRing size={14} aria-hidden="true" />
        {unread > 0 && (
          <span
            aria-hidden="true"
            className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-negative px-1 font-mono text-[9px] leading-none font-bold text-white"
          >
            {badgeText(unread)}
          </span>
        )}
      </button>
      {open && <BellPanel id={panelId} onClose={() => setOpen(false)} />}
    </div>
  );
}

function BellPanel({ id, onClose }: { id: string; onClose: () => void }) {
  const copy = useCopy();
  const n = copy.notifications;
  const { show } = useToast();
  const latest = useLatestNotifications(LATEST);
  const markAll = useMarkAllRead();
  const open = useOpenNotification(onClose);
  const items = latest.data?.items ?? [];
  const anyUnread = items.some((item) => !item.read);

  return (
    <div
      id={id}
      role="dialog"
      aria-label={n.title}
      className="fixed inset-x-4 top-20 z-50 overflow-hidden rounded-xl border border-line-strong bg-surface shadow-overlay sm:absolute sm:inset-x-auto sm:top-full sm:right-0 sm:mt-2 sm:w-[380px]"
    >
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="text-sm font-semibold text-fg">{n.title}</h2>
        <button
          type="button"
          disabled={!anyUnread || markAll.pending}
          onClick={() =>
            void markAll.run().then((result) => {
              if (result.status === 'error')
                show({ tone: 'error', message: errorText(copy, result.error) });
            })
          }
          className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline disabled:cursor-not-allowed disabled:text-muted-x disabled:no-underline"
        >
          <CheckCheck size={12} aria-hidden="true" />
          {n.markAllRead}
        </button>
      </div>
      <div className="max-h-[min(440px,60vh)] overflow-y-auto p-1.5">
        {latest.isPending ? (
          <div className="grid gap-2 p-2">
            {[0, 1, 2].map((k) => (
              <Skeleton key={k} className="h-12 w-full" />
            ))}
          </div>
        ) : latest.isError ? (
          <p className="px-3 py-6 text-center text-xs text-muted-dim">
            {errorText(copy, latest.error)}
          </p>
        ) : items.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-muted-dim">
            {n.empty}
          </p>
        ) : (
          <ul>
            {items.map((item) => (
              <li key={item.id}>
                <NotificationItem notification={item} onOpen={open} compact />
              </li>
            ))}
          </ul>
        )}
      </div>
      <Link
        to="/notifications"
        onClick={onClose}
        className="block border-t border-line px-4 py-2.5 text-center text-xs font-medium text-primary no-underline hover:bg-raised"
      >
        {n.viewAll}
      </Link>
    </div>
  );
}
