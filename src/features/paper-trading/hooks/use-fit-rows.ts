import { useEffect, useState } from 'react';

/** Height of one order book or trades row (`h-5`). */
export const ROW_PX = 20;

/**
 * How many rows of `ROW_PX` fit in an element, up to `max`, kept up to
 * date as the element resizes, so a panel shows as many levels as its
 * column has room for. Without a measure yet (first paint, or no
 * ResizeObserver) it answers `fallback`.
 */
export function useFitRows(max: number, fallback: number) {
  const [element, setElement] = useState<HTMLElement | null>(null);
  const [height, setHeight] = useState<number | null>(null);

  useEffect(() => {
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setHeight(entry.contentRect.height);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);

  const rows =
    height === null
      ? fallback
      : Math.max(1, Math.min(max, Math.floor(height / ROW_PX)));
  return { measure: setElement, rows };
}
