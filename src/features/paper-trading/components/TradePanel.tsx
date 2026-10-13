import type { PropsWithChildren, ReactNode } from 'react';
import { classNames } from '../../../utils/class-names';

/**
 * One region of the trading screen: a titled surface. The order book,
 * trades, order form and the bottom panel fill theirs in TR-F2 and TR-F3.
 */
export function TradePanel({
  title,
  actions,
  className,
  children,
}: PropsWithChildren<{
  title: string;
  /** Controls at the right of the title (view, grouping, latency). */
  actions?: ReactNode;
  className?: string | undefined;
}>) {
  return (
    <section
      aria-label={title}
      className={classNames(
        'flex min-w-0 flex-col rounded-xl border border-line bg-surface p-3',
        className,
      )}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <h2 className="text-[10px] font-semibold tracking-widest whitespace-nowrap text-muted-x uppercase">
          {title}
        </h2>
        {actions && <div className="flex items-center gap-1.5">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

/** What a region will hold once its backend feed is merged. */
export function ComingSoon({ text }: { text: string }) {
  return (
    <p className="flex flex-1 items-center justify-center px-2 py-8 text-center text-xs text-muted-dim">
      {text}
    </p>
  );
}
