import { useCallback, useEffect, useRef, useState } from 'react';

const nextFrame = (callback: () => void): (() => void) => {
  if (typeof window.requestAnimationFrame === 'function') {
    const id = window.requestAnimationFrame(callback);
    return () => window.cancelAnimationFrame(id);
  }
  const id = setTimeout(callback, 16);
  return () => clearTimeout(id);
};

/**
 * State that takes updates at any rate but renders at most once per
 * animation frame: a burst of depth or trade messages becomes one paint
 * (plan section 12).
 *
 * Each update is applied as it arrives to the newest value, and only that
 * value waits for the frame. A hidden tab runs no animation frames, so
 * queueing the updates themselves would grow without bound while it stays
 * hidden (ten depth books a second) and replay them all at once on return;
 * folding them keeps one value, and the tab shows the latest on return.
 */
export function useFrameState<T>(
  initial: () => T,
): [T, (update: (current: T) => T) => void] {
  const [state, setState] = useState(initial);
  // Every update goes through `push`, so this is always the newest value.
  const latest = useRef(state);
  const cancel = useRef<(() => void) | null>(null);

  useEffect(
    () => () => {
      cancel.current?.();
      cancel.current = null;
    },
    [],
  );

  const push = useCallback((update: (current: T) => T) => {
    latest.current = update(latest.current);
    cancel.current ??= nextFrame(() => {
      cancel.current = null;
      setState(latest.current);
    });
  }, []);

  return [state, push];
}
