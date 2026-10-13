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
 * (plan section 12). Updates queued at unmount are dropped.
 */
export function useFrameState<T>(
  initial: () => T,
): [T, (update: (current: T) => T) => void] {
  const [state, setState] = useState(initial);
  const queue = useRef<((current: T) => T)[]>([]);
  const cancel = useRef<(() => void) | null>(null);

  useEffect(
    () => () => {
      cancel.current?.();
      cancel.current = null;
      queue.current = [];
    },
    [],
  );

  const push = useCallback((update: (current: T) => T) => {
    queue.current.push(update);
    cancel.current ??= nextFrame(() => {
      cancel.current = null;
      const updates = queue.current;
      queue.current = [];
      setState((current) =>
        updates.reduce((value, apply) => apply(value), current),
      );
    });
  }, []);

  return [state, push];
}
