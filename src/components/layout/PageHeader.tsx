import type { ReactNode } from 'react';
import { classNames } from '../../utils/class-names';

/** Figma page header: compact title, muted subtitle, actions on the right. */
export function PageHeader({
  title,
  description,
  actions,
  size = 'lg',
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  /** `sm` is the admin console size. */
  size?: 'sm' | 'lg';
}) {
  return (
    <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div className="min-w-0">
        <h1
          className={classNames(
            'font-semibold text-fg',
            size === 'lg' ? 'text-lg' : 'text-sm',
          )}
        >
          {title}
        </h1>
        {description && (
          <p className="mt-0.5 text-xs text-muted-dim">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}
