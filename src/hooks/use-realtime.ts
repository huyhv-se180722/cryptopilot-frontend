import { useEffect, useSyncExternalStore } from 'react';
import type { RealtimeClient } from '../services/websocket/realtime-client';

/** App provider owns connect/dispose. Hooks own only their subscriptions. */
export function useRealtime<T>(
  client: RealtimeClient<T>,
  topic: string,
  onMessage: (message: T) => void,
) {
  const state = useSyncExternalStore(
    client.onStateChange,
    client.getState,
    client.getState,
  );
  useEffect(
    () => client.subscribe(topic, onMessage),
    [client, topic, onMessage],
  );
  return state;
}
