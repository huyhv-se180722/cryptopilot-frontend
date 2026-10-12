import { useCopy } from '../../../hooks/use-copy';
import { classNames } from '../../../utils/class-names';
import type { FeedFreshness } from '../hooks/use-market-tickers';

const tones: Record<FeedFreshness, { box: string; dot: string }> = {
  live: {
    box: 'border-positive-line bg-positive-soft text-positive',
    dot: 'bg-positive motion-safe:animate-[pulse-led_2s_ease-in-out_infinite]',
  },
  delayed: {
    box: 'border-warning-line bg-warning-soft text-warning',
    dot: 'bg-warning',
  },
  connecting: { box: 'border-line bg-raised text-muted', dot: 'bg-muted' },
};

/** CR-09 Live / Delayed indicator (Figma market header pill). */
export function FreshnessBadge({ freshness }: { freshness: FeedFreshness }) {
  const copy = useCopy();
  const m = copy.market;
  const { box, dot } = tones[freshness];
  return (
    <span
      role="status"
      aria-live="polite"
      title={freshness === 'delayed' ? m.delayedHint : undefined}
      className={classNames(
        'inline-flex h-7 shrink-0 items-center gap-2 rounded-full border px-3 text-xs font-medium',
        box,
      )}
    >
      <span
        aria-hidden="true"
        className={classNames('size-1.5 rounded-full', dot)}
      />
      {m[freshness]}
      {freshness === 'delayed' && (
        <span className="sr-only">. {m.delayedHint}</span>
      )}
    </span>
  );
}
