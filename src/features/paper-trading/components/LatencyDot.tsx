import { useEffect, useState } from 'react';
import { useCopy } from '../../../hooks/use-copy';
import { formatCopy } from '../../../i18n/copy';
import { classNames } from '../../../utils/class-names';

/** Under 1.5 s since the last message is live, under 5 s slow (plan section 12). */
const LIVE_MS = 1_500;
const SLOW_MS = 5_000;

/**
 * How fresh a realtime panel is: a coloured dot with its meaning as the
 * accessible name and tooltip, so colour is never the only signal.
 */
export function LatencyDot({ updatedAt }: { updatedAt: number | null }) {
  const copy = useCopy();
  const p = copy.paper;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, []);
  const age = updatedAt === null ? null : Math.max(0, now - updatedAt);
  const [label, tone] =
    age === null
      ? [p.latencyWaiting, 'bg-muted-dim']
      : age < LIVE_MS
        ? [p.latencyLive, 'bg-positive']
        : age < SLOW_MS
          ? [p.latencySlow, 'bg-warning']
          : [p.latencyStalled, 'bg-negative'];
  const text =
    age === null
      ? label
      : formatCopy(p.latencyAge, {
          label,
          seconds: (age / 1000).toFixed(1),
        });
  return (
    <span
      role="img"
      aria-label={text}
      title={text}
      className={classNames('inline-block size-2 rounded-full', tone)}
    />
  );
}
