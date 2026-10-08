import type { PropsWithChildren } from 'react';
import { classNames } from '../../utils/class-names';

export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

const pill: Record<Tone, string> = {
  neutral: 'border-line bg-raised text-muted-dim',
  info: 'border-primary-line bg-primary-soft text-primary',
  success: 'border-positive-line bg-positive-soft text-positive',
  warning: 'border-warning-line bg-warning-soft text-warning',
  danger: 'border-negative-line bg-negative-soft text-negative',
};

const dot: Record<Tone, string> = {
  neutral: 'bg-muted-dim',
  info: 'bg-primary',
  success: 'bg-positive',
  warning: 'bg-warning',
  danger: 'bg-negative',
};

/** Figma StatusBadge: rounded pill, optional leading dot. */
export function Badge({
  tone = 'neutral',
  withDot = false,
  children,
}: PropsWithChildren<{ tone?: Tone; withDot?: boolean }>) {
  return (
    <span
      className={classNames(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold',
        pill[tone],
      )}
    >
      {withDot && (
        <span
          aria-hidden="true"
          className={classNames('size-[5px] shrink-0 rounded-full', dot[tone])}
        />
      )}
      {children}
    </span>
  );
}

/** Figma StatusDot with a text label (never colour alone). */
export function StatusIndicator({
  tone = 'neutral',
  label,
}: {
  tone?: Tone;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-fg-2">
      <span
        aria-hidden="true"
        className={classNames('size-1.5 shrink-0 rounded-full', dot[tone])}
      />
      {label}
    </span>
  );
}
