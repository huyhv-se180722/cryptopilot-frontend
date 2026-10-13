import type { PropsWithChildren, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { classNames } from '../../../utils/class-names';

/**
 * Figma dashboard panel: 13px title bar with a link at the right, 1px
 * separator, content below.
 */
export function DashboardCard({
  title,
  link,
  actions,
  className,
  children,
}: PropsWithChildren<{
  title: string;
  link?: { to: string; label: string } | undefined;
  actions?: ReactNode;
  className?: string | undefined;
}>) {
  return (
    <section
      aria-label={title}
      className={classNames(
        'flex min-w-0 flex-col rounded-xl border border-line bg-surface',
        className,
      )}
    >
      <div className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 border-b border-line px-4 py-2">
        <h2 className="mr-auto text-[13px] font-semibold text-fg">{title}</h2>
        {actions}
        {link && (
          <Link
            to={link.to}
            className="inline-flex items-center gap-0.5 text-xs no-underline"
          >
            {link.label}
            <ChevronRight size={12} aria-hidden="true" />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

/** A block whose backend part is not connected yet: says so, invents nothing. */
export function PendingBlock({ message }: { message: string }) {
  return (
    <p className="flex flex-1 items-center justify-center px-4 py-8 text-center text-xs text-muted-dim">
      {message}
    </p>
  );
}
