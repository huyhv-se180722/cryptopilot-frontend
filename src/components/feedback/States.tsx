import type { PropsWithChildren, ReactNode } from 'react';
import {
  AlertTriangle,
  CircleAlert,
  Inbox,
  Info,
  Loader2,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { classNames } from '../../utils/class-names';
import { useCopy } from '../../hooks/use-copy';

type AlertTone = 'info' | 'warning' | 'danger';

const alertTone: Record<AlertTone, { box: string; icon: LucideIcon }> = {
  info: { box: 'border-primary-line bg-primary-soft text-primary', icon: Info },
  warning: {
    box: 'border-warning-line bg-warning-soft text-warning',
    icon: AlertTriangle,
  },
  danger: {
    box: 'border-negative-line bg-negative-soft text-negative',
    icon: CircleAlert,
  },
};

export function Alert({
  title,
  children,
  tone = 'info',
  className,
}: PropsWithChildren<{ title: string; tone?: AlertTone; className?: string }>) {
  const { box, icon: Icon } = alertTone[tone];
  return (
    <div
      className={classNames(
        'flex gap-2.5 rounded-lg border px-4 py-3 text-xs',
        box,
        className,
      )}
      role={tone === 'danger' ? 'alert' : 'status'}
    >
      <Icon size={14} aria-hidden="true" className="mt-px shrink-0" />
      <div>
        <strong className="block font-semibold">{title}</strong>
        {children && <div className="mt-0.5 text-fg-2">{children}</div>}
      </div>
    </div>
  );
}
export function Warning({
  title,
  children,
  className,
}: PropsWithChildren<{ title: string; className?: string }>) {
  return (
    <Alert title={title} tone="warning" {...(className ? { className } : {})}>
      {children}
    </Alert>
  );
}
export function Loading({ label }: { label?: string }) {
  const copy = useCopy();
  return (
    <div
      className="flex items-center justify-center gap-2 px-4 py-10 text-xs text-muted"
      role="status"
      aria-live="polite"
    >
      <Loader2
        size={15}
        aria-hidden="true"
        className="animate-spin text-primary"
      />
      {label ?? copy.common.loading}
    </div>
  );
}
/**
 * `block` fills a page or a main panel; `inline` is one line for a side
 * block that failed or has nothing to show while the rest of the screen
 * works (T-141), so it never outweighs the content around it.
 */
export type StateVariant = 'block' | 'inline';

export function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
  action,
  variant = 'block',
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: ReactNode;
  variant?: StateVariant;
}) {
  if (variant === 'inline') {
    return (
      <div className="flex items-center gap-2.5 rounded-lg border border-line px-3 py-2.5 text-xs">
        <Icon size={15} aria-hidden="true" className="shrink-0 text-muted-x" />
        <p className="min-w-0 flex-1">
          <span className="font-medium text-fg-2">{title}</span>
          {description && (
            <span className="text-muted-dim"> {description}</span>
          )}
        </p>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center px-4 py-12 text-center">
      <Icon size={32} aria-hidden="true" className="mb-3 text-muted-x" />
      <h2 className="text-sm font-semibold text-fg">{title}</h2>
      {description && (
        <p className="mt-1 max-w-sm text-xs text-muted-dim">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
export function ErrorState({
  title,
  message,
  onRetry,
  variant = 'block',
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
  variant?: StateVariant;
}) {
  const copy = useCopy();
  if (variant === 'inline') {
    return (
      <div
        className="flex items-center gap-2.5 rounded-lg border border-negative-line bg-negative-soft px-3 py-2 text-xs"
        role="alert"
      >
        <AlertTriangle
          size={15}
          aria-hidden="true"
          className="shrink-0 text-negative"
        />
        <p className="min-w-0 flex-1">
          <span className="font-medium text-fg">
            {title ?? copy.common.somethingWrong}
          </span>
          <span className="text-muted-dim"> {message}</span>
        </p>
        {onRetry && (
          <Button
            variant="secondary"
            size="sm"
            className="shrink-0"
            onClick={onRetry}
          >
            {copy.common.retry}
          </Button>
        )}
      </div>
    );
  }
  return (
    <div
      className="flex flex-col items-center px-4 py-12 text-center"
      role="alert"
    >
      <div className="mb-4 flex size-14 items-center justify-center rounded-full border border-negative-line bg-negative-soft">
        <AlertTriangle size={24} aria-hidden="true" className="text-negative" />
      </div>
      <h2 className="text-base font-semibold text-fg">
        {title ?? copy.common.somethingWrong}
      </h2>
      <p className="mt-1 max-w-sm text-sm text-muted-dim">{message}</p>
      {onRetry && (
        <Button variant="secondary" className="mt-5" onClick={onRetry}>
          {copy.common.retry}
        </Button>
      )}
    </div>
  );
}
