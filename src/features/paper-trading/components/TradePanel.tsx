import type { PropsWithChildren } from 'react';
import { classNames } from '../../../utils/class-names';

/**
 * One region of the trading screen: a titled surface. The order book,
 * trades, order form and the bottom panel fill theirs in TR-F2 and TR-F3.
 */
export function TradePanel({
  title,
  className,
  children,
}: PropsWithChildren<{ title: string; className?: string }>) {
  return (
    <section
      aria-label={title}
      className={classNames(
        'flex min-w-0 flex-col rounded-xl border border-line bg-surface p-3',
        className,
      )}
    >
      <h2 className="mb-2 text-[10px] font-semibold tracking-widest text-muted-x uppercase">
        {title}
      </h2>
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
