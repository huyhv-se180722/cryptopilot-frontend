import { useCallback, useSyncExternalStore } from 'react';

/**
 * Whether a CSS media query matches, following changes (a window resized
 * or rotated). Without `matchMedia` (tests, older engines) it is false.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window.matchMedia !== 'function') return () => undefined;
      const media = window.matchMedia(query);
      media.addEventListener('change', onChange);
      return () => media.removeEventListener('change', onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () =>
      typeof window.matchMedia === 'function' &&
      window.matchMedia(query).matches,
    () => false,
  );
}
