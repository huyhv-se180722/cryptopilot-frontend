import type { PropsWithChildren } from 'react';
import { Button } from '../ui/Button';

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
export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="feedback" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      {label}
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
  title = 'Something went wrong',
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="feedback" role="alert">
      <h2>{title}</h2>
      <p>{message}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
