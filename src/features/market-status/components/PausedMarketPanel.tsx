import { PauseCircle } from 'lucide-react';
import { useCopy } from '../../../hooks/use-copy';
import { classNames } from '../../../utils/class-names';

/**
 * In place of the order book and the recent trades while a market's exchange
 * data is lost (D-159): a fallback book would mislead, so none is shown.
 */
export function PausedMarketPanel({ className }: { className?: string }) {
  const c = useCopy().marketStatus;
  return (
    <div
      data-testid="paused-market-panel"
      className={classNames(
        'flex flex-col items-center justify-center gap-2 rounded-xl border border-line bg-surface p-4 text-center',
        className,
      )}
    >
      <PauseCircle size={20} aria-hidden="true" className="text-warning" />
      <p className="text-sm font-semibold text-fg">{c.bookPaused}</p>
      <p className="text-xs text-muted">{c.bookPausedBody}</p>
    </div>
  );
}
