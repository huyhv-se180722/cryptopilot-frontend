import { Client, ReconnectionTimeMode } from '@stomp/stompjs';
import type { MarketOverview, MarketType } from '../../types/domain';
import type { FeedStatus, MarketFeed } from '../api/contracts';
import { decodeOverview } from '../api/market-dto';

/** The part of the STOMP client the feed uses; tests pass a fake. */
export type StompConnection = Pick<
  Client,
  | 'activate'
  | 'deactivate'
  | 'subscribe'
  | 'onConnect'
  | 'onWebSocketClose'
  | 'onStompError'
>;

/**
 * Reconnect from 1 s, doubling up to 60 s (TD 9). The broker sends no
 * heart-beats, so none are expected; staleness is judged by the screens
 * from the last message (CR-09, 10 s).
 */
function createStompClient(url: string): StompConnection {
  return new Client({
    brokerURL: url,
    reconnectDelay: 1_000,
    maxReconnectDelay: 60_000,
    reconnectTimeMode: ReconnectionTimeMode.EXPONENTIAL,
    heartbeatIncoming: 0,
  });
}

type Listener = (overview: MarketOverview) => void;

const destinationOf = (market: MarketType) =>
  '/topic/overview.' + market.toUpperCase();

/**
 * Public market topics over one STOMP connection (`/ws`, no SockJS). The
 * socket opens with the first subscriber and closes with the last; every
 * destination is one STOMP subscription shared by its listeners and is
 * subscribed again after a reconnect. Bodies that fail decoding are
 * dropped.
 */
export function createStompMarketFeed(
  url: string,
  connect: (url: string) => StompConnection = createStompClient,
): MarketFeed {
  let connection: StompConnection | null = null;
  let status: FeedStatus = 'closed';
  const statusListeners = new Set<() => void>();
  const listeners = new Map<string, Set<Listener>>();
  const active = new Map<string, { unsubscribe(): void }>();

  const setStatus = (next: FeedStatus) => {
    if (status === next) return;
    status = next;
    statusListeners.forEach((listener) => listener());
  };

  const subscribeOnServer = (destination: string) => {
    if (!connection || status !== 'open' || active.has(destination)) return;
    active.set(
      destination,
      connection.subscribe(destination, (message) => {
        let overview: MarketOverview;
        try {
          overview = decodeOverview(JSON.parse(message.body));
        } catch {
          return;
        }
        listeners.get(destination)?.forEach((listener) => listener(overview));
      }),
    );
  };

  const open = () => {
    if (connection) return;
    const next = connect(url);
    connection = next;
    next.onConnect = () => {
      if (connection !== next) return;
      active.clear();
      setStatus('open');
      listeners.forEach((_, destination) => subscribeOnServer(destination));
    };
    next.onWebSocketClose = () => {
      if (connection !== next) return;
      active.clear();
      setStatus('connecting');
    };
    next.onStompError = () => {
      if (connection !== next) return;
      setStatus('connecting');
    };
    setStatus('connecting');
    next.activate();
  };

  const close = () => {
    const current = connection;
    connection = null;
    active.clear();
    setStatus('closed');
    void current?.deactivate();
  };

  return {
    status: () => status,
    onStatus(listener) {
      statusListeners.add(listener);
      return () => {
        statusListeners.delete(listener);
      };
    },
    subscribeOverview(market, listener) {
      const destination = destinationOf(market);
      let set = listeners.get(destination);
      if (!set) {
        set = new Set();
        listeners.set(destination, set);
      }
      set.add(listener);
      open();
      subscribeOnServer(destination);
      let subscribed = true;
      return () => {
        if (!subscribed) return;
        subscribed = false;
        set.delete(listener);
        if (set.size > 0) return;
        listeners.delete(destination);
        active.get(destination)?.unsubscribe();
        active.delete(destination);
        if (listeners.size === 0) close();
      };
    },
  };
}
