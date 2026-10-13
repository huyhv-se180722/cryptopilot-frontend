import { useEffect, useRef, useSyncExternalStore } from 'react';
import { useServices } from './use-services';

/**
 * Calls `onOpen` each time the market feed opens, the first time and after
 * every loss. A snapshot read over REST misses what happened between the
 * read and the moment the topic flows, and everything a lost connection
 * did not deliver: reading it again once the feed is open fills that gap
 * (subscribe first, then read, as an exchange's order book procedure does).
 */
export function useOnFeedOpen(onOpen: () => void): void {
  const { marketFeed } = useServices();
  const status = useSyncExternalStore(
    marketFeed.onStatus,
    marketFeed.status,
    marketFeed.status,
  );
  const previous = useRef(status);
  const latest = useRef(onOpen);
  useEffect(() => {
    latest.current = onOpen;
  });
  useEffect(() => {
    const wasDown = previous.current !== 'open';
    previous.current = status;
    if (status === 'open' && wasDown) latest.current();
  }, [status]);
}
