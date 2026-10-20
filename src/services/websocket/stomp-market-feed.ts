import { Client, ReconnectionTimeMode } from '@stomp/stompjs';
import type { FeedStatus, MarketFeed } from '../api/contracts';
import { decodeKline, decodeOverview, decodeTicker } from '../api/market-dto';

/** The part of the STOMP client the feed uses; tests pass a fake. */
export type StompConnection = Pick<
  Client,
  | 'activate'
  | 'deactivate'
  | 'subscribe'
  | 'forceDisconnect'
  | 'onConnect'
  | 'onWebSocketClose'
  | 'onStompError'
>;

/**
 * Reconnect from 1 s, doubling up to 60 s (TD 9). Heart-beats are asked
 * for both ways: the broker negotiates them off today, and the day it
 * sends them a missed one closes the socket. Meanwhile the feed watches
 * the messages themselves (see `SILENCE_LIMIT_MS`).
 */
function createStompClient(
  url: string,
  token?: () => Promise<string | null>,
): StompConnection {
  return new Client({
    brokerURL: url,
    // Read before every (re)connect, so a reconnect presents the current
    // token; the backend checks it once, when the session connects.
    ...(token
      ? {
          beforeConnect: async (client: Client) => {
            const current = await token();
            client.connectHeaders = current
              ? { Authorization: 'Bearer ' + current }
              : {};
          },
        }
      : {}),
    reconnectDelay: 1_000,
    maxReconnectDelay: 60_000,
    reconnectTimeMode: ReconnectionTimeMode.EXPONENTIAL,
    heartbeatIncoming: 10_000,
    heartbeatOutgoing: 10_000,
    // A socket given up on (missed heart-beat, silence) is dropped at once
    // instead of waiting for a closing handshake a dead peer never answers.
    discardWebsocketOnCommFailure: true,
  });
}

/**
 * A connection signed in with `token` (`Authorization` in the CONNECT
 * frame), for the user queues of TR-08; the public topics need none.
 */
export function signedInStompClient(
  token: () => Promise<string | null>,
): (url: string) => StompConnection {
  return (url) => createStompClient(url, token);
}

/**
 * No message on any topic for this long while open means a half-open
 * socket (a laptop waking up, a proxy that dropped it silently): a browser
 * shows no WebSocket ping or pong to scripts, so nothing else would notice
 * and the screens would stay Delayed. The socket is closed and reopened;
 * while the silence goes on, the limit doubles up to `SILENCE_LIMIT_MAX_MS`
 * so a backend that has lost its own exchange feed is not reconnected to
 * every half minute.
 */
export const SILENCE_LIMIT_MS = 30_000;
const SILENCE_LIMIT_MAX_MS = 300_000;
const WATCH_EVERY_MS = 5_000;
/**
 * Topics that push at least once a second whatever the market does
 * (ticker and overview each second, depth each 100 ms); klines and trades
 * may be quiet, so a feed carrying only those is not judged.
 */
const STEADY = /^\/topic\/(overview|ticker|depth)\./;

/** Time for the silence watch; tests pass a fake. */
export interface FeedClock {
  now(): number;
  every(callback: () => void, ms: number): () => void;
}

const browserClock: FeedClock = {
  now: () => Date.now(),
  every: (callback, ms) => {
    const id = setInterval(callback, ms);
    return () => clearInterval(id);
  },
};

type Listener = (body: unknown) => void;

/**
 * Public market topics over one STOMP connection (`/ws`, no SockJS). The
 * socket opens with the first subscriber and closes with the last; every
 * destination is one STOMP subscription shared by its listeners and is
 * subscribed again after a reconnect. Bodies that fail decoding are
 * dropped.
 */
/**
 * Any other public topic on the same connection, decoded on arrival; the
 * TR-03 depth and trades topics use it (D-104).
 */
export interface StompTopics {
  subscribeTopic<T>(
    destination: string,
    decode: (body: unknown) => T,
    listener: (value: T) => void,
  ): () => void;
}

export function createStompMarketFeed(
  url: string,
  connect: (url: string) => StompConnection = createStompClient,
  clock: FeedClock = browserClock,
): MarketFeed & StompTopics {
  let connection: StompConnection | null = null;
  let status: FeedStatus = 'closed';
  const statusListeners = new Set<() => void>();
  const listeners = new Map<string, Set<Listener>>();
  const active = new Map<string, { unsubscribe(): void }>();
  let lastMessageAt = clock.now();
  let silenceLimit = SILENCE_LIMIT_MS;
  let stopWatch: (() => void) | null = null;

  const watch = () => {
    if (!connection || status !== 'open') return;
    if (![...listeners.keys()].some((destination) => STEADY.test(destination)))
      return;
    if (clock.now() - lastMessageAt < silenceLimit) return;
    silenceLimit = Math.min(silenceLimit * 2, SILENCE_LIMIT_MAX_MS);
    lastMessageAt = clock.now();
    connection.forceDisconnect();
  };

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
        lastMessageAt = clock.now();
        silenceLimit = SILENCE_LIMIT_MS;
        let body: unknown;
        try {
          body = JSON.parse(message.body);
        } catch {
          return;
        }
        listeners.get(destination)?.forEach((listener) => listener(body));
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
      // The silence is counted from the opening.
      lastMessageAt = clock.now();
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
    stopWatch = clock.every(watch, WATCH_EVERY_MS);
    next.activate();
  };

  const close = () => {
    const current = connection;
    connection = null;
    active.clear();
    stopWatch?.();
    stopWatch = null;
    silenceLimit = SILENCE_LIMIT_MS;
    setStatus('closed');
    void current?.deactivate();
  };

  /** Adds a listener to a destination; bodies that do not decode are dropped. */
  function follow<T>(
    destination: string,
    decode: (body: unknown) => T,
    listener: (value: T) => void,
  ): () => void {
    const receive: Listener = (body) => {
      let value: T;
      try {
        value = decode(body);
      } catch {
        return;
      }
      listener(value);
    };
    let set = listeners.get(destination);
    if (!set) {
      set = new Set();
      listeners.set(destination, set);
    }
    set.add(receive);
    open();
    subscribeOnServer(destination);
    let subscribed = true;
    return () => {
      if (!subscribed) return;
      subscribed = false;
      set.delete(receive);
      if (set.size > 0) return;
      listeners.delete(destination);
      active.get(destination)?.unsubscribe();
      active.delete(destination);
      if (listeners.size === 0) close();
    };
  }

  return {
    subscribeTopic: follow,
    status: () => status,
    onStatus(listener) {
      statusListeners.add(listener);
      return () => {
        statusListeners.delete(listener);
      };
    },
    subscribeOverview: (market, listener) =>
      follow(
        '/topic/overview.' + market.toUpperCase(),
        decodeOverview,
        listener,
      ),
    subscribeTicker: (market, symbol, listener) =>
      follow(
        `/topic/ticker.${market.toUpperCase()}.${symbol.toUpperCase()}`,
        decodeTicker,
        listener,
      ),
    subscribeKline: (market, symbol, timeframe, listener) =>
      follow(
        `/topic/kline.${market.toUpperCase()}.${symbol.toUpperCase()}.${timeframe}`,
        decodeKline,
        listener,
      ),
  };
}
