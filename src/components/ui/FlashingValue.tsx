import { useEffect, useRef, useState } from 'react';
import { classNames } from '../../utils/class-names';
import { compareDecimal } from '../../utils/decimal-format';

/**
 * A live number that turns green when it rises and red when it falls, then
 * fades back, so a change in the stream is seen without reading every
 * digit. `holdMs` is how long the colour stays before it fades out.
 */
export function FlashingValue({
  value,
  text,
  holdMs = 700,
  className,
}: {
  value: string;
  text: string;
  holdMs?: number;
  className?: string;
}) {
  const previous = useRef(value);
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);
  useEffect(() => {
    if (value === previous.current) return;
    const direction = compareDecimal(value, previous.current);
    previous.current = value;
    if (direction === 0) return;
    setFlash(direction > 0 ? 'up' : 'down');
    const timer = window.setTimeout(() => setFlash(null), holdMs);
    return () => window.clearTimeout(timer);
  }, [value, holdMs]);
  return (
    <span
      data-flash={flash ?? undefined}
      className={classNames(
        'rounded px-1 transition-colors duration-500',
        flash === 'up' && 'bg-positive-soft text-positive',
        flash === 'down' && 'bg-negative-soft text-negative',
        className,
      )}
    >
      {text}
    </span>
  );
}
