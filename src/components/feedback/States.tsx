import type { PropsWithChildren } from 'react';
import { Button } from '../ui/Button';
import { useCopy } from '../../hooks/use-copy';

export function Alert({
  title,
  children,
  tone = 'info',
}: PropsWithChildren<{ title: string; tone?: 'info' | 'warning' | 'danger' }>) {
  return (
    <div
      className={'alert tone-' + tone}
      role={tone === 'danger' ? 'alert' : 'status'}
    >
      <strong>{title}</strong>
      {children && <div>{children}</div>}
    </div>
  );
}
export function Warning({
  title,
  children,
}: PropsWithChildren<{ title: string }>) {
  return (
    <Alert title={title} tone="warning">
      {children}
    </Alert>
  );
}
export function Loading({ label }: { label?: string }) {
  const copy = useCopy();
  return (
    <div className="feedback" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      {label ?? copy.common.loading}
    </div>
  );
}
export function EmptyState({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="feedback">
      <h2>{title}</h2>
      {description && <p>{description}</p>}
    </div>
  );
}
export function ErrorState({
  title,
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  const copy = useCopy();
  return (
    <div className="feedback" role="alert">
      <h2>{title ?? copy.common.somethingWrong}</h2>
      <p>{message}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          {copy.common.retry}
        </Button>
      )}
    </div>
  );
}
