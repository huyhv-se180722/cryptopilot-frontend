import type { PropsWithChildren } from 'react';
type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';
export function Badge({
  tone = 'neutral',
  children,
}: PropsWithChildren<{ tone?: Tone }>) {
  return <span className={'badge tone-' + tone}>{children}</span>;
}
export function StatusIndicator({
  tone = 'neutral',
  label,
}: {
  tone?: Tone;
  label: string;
}) {
  return (
    <span className={'status tone-' + tone}>
      <span className="status-dot" aria-hidden="true" />
      {label}
    </span>
  );
}
