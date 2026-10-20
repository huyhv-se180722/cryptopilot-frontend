import { describe, expect, it, vi } from 'vitest';
import type { MarketOverview } from '../../types/domain';
import {
  SILENCE_LIMIT_MS,
  createStompMarketFeed,
  signedInStompClient,
  type FeedClock,
  type StompConnection,
} from './stomp-market-feed';

const OVERVIEW = {
  market: 'SPOT',
  serverTime: '2026-10-03T02:15:06Z',
  tickers: [
    {
      market: 'SPOT',
      symbol: 'BTCUSDT',
      sourceTime: '2026-10-03T02:15:04.120Z',
      lastPrice: '63000.01',
      bestBid: null,
      bestAsk: null,
      high24h: null,
      low24h: null,
      changePercent24h: '1.25',
      baseVolume24h: null,
      quoteVolume24h: null,
      markPrice: null,
      indexPrice: null,
      fundingRate: null,
      nextFundingTime: null,
    },
  ],
};

/** In-memory stand-in for the STOMP client: records subscriptions. */
function fakeConnection() {
  const subscriptions = new Map<string, (message: { body: string }) => void>();
  const unsubscribed: string[] = [];
  const connection = {
    activate: vi.fn(),
    deactivate: vi.fn(async () => undefined),
    subscribe: vi.fn(
      (destination: string, callback: (message: { body: string }) => void) => {
        subscriptions.set(destination, callback);
        return {
          unsubscribe: () => {
            unsubscribed.push(destination);
            subscriptions.delete(destination);
          },
        };
      },
    ),
    onConnect: () => undefined,
    onWebSocketClose: () => undefined,
    onStompError: () => undefined,
    // Closing the socket reports a close, after which the client reconnects.
    forceDisconnect: vi.fn(() =>
      (connection.onWebSocketClose as unknown as () => void)(),
    ),
  };
  const send = (destination: string, body: string) =>
    subscriptions.get(destination)?.({ body });
  return { connection, subscriptions, unsubscribed, send };
}

/** A clock the test moves; the watch runs when it is told to. */
function fakeClock() {
  let now = 0;
  const watches = new Set<() => void>();
  const clock: FeedClock = {
    now: () => now,
    every: (callback) => {
      watches.add(callback);
      return () => watches.delete(callback);
    },
  };
  const advance = (ms: number) => {
    now += ms;
    watches.forEach((watch) => watch());
  };
  return { clock, advance, watching: () => watches.size };
}

function setup() {
  const fake = fakeConnection();
  const time = fakeClock();
  const connect = vi.fn(() => fake.connection as unknown as StompConnection);
  const feed = createStompMarketFeed(
    'ws://localhost:8080/ws',
    connect,
    time.clock,
  );
  const connected = () =>
    (fake.connection.onConnect as unknown as () => void)();
  const dropped = () =>
    (fake.connection.onWebSocketClose as unknown as () => void)();
  return { feed, fake, connect, connected, dropped, time };
}

describe('STOMP market feed', () => {
  it('opens with the first subscriber and subscribes once connected', () => {
    const { feed, fake, connect, connected } = setup();
    expect(feed.status()).toBe('closed');
    const received: MarketOverview[] = [];
    feed.subscribeOverview('spot', (overview) => received.push(overview));
    expect(connect).toHaveBeenCalledWith('ws://localhost:8080/ws');
    expect(feed.status()).toBe('connecting');
    expect(fake.subscriptions.size).toBe(0);
    connected();
    expect(feed.status()).toBe('open');
    fake.send('/topic/overview.SPOT', JSON.stringify(OVERVIEW));
    expect(received[0]?.tickers[0]).toMatchObject({
      market: 'spot',
      symbol: 'BTCUSDT',
      lastPrice: '63000.01',
    });
  });

  it('drops bodies that do not decode', () => {
    const { feed, fake, connected } = setup();
    const listener = vi.fn();
    feed.subscribeOverview('spot', listener);
    connected();
    fake.send('/topic/overview.SPOT', '{"market":"SPOT"}');
    fake.send('/topic/overview.SPOT', 'not json');
    expect(listener).not.toHaveBeenCalled();
  });

  it('shares one subscription per topic and subscribes again after a drop', () => {
    const { feed, fake, connected, dropped } = setup();
    const first = vi.fn();
    const second = vi.fn();
    const stopFirst = feed.subscribeOverview('futures', first);
    feed.subscribeOverview('futures', second);
    connected();
    expect(fake.connection.subscribe).toHaveBeenCalledTimes(1);
    dropped();
    expect(feed.status()).toBe('connecting');
    connected();
    expect(fake.connection.subscribe).toHaveBeenCalledTimes(2);
    stopFirst();
    fake.send(
      '/topic/overview.FUTURES',
      JSON.stringify({ ...OVERVIEW, market: 'FUTURES', tickers: [] }),
    );
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('routes a pair to its ticker topic', () => {
    const { feed, fake, connected } = setup();
    const listener = vi.fn();
    feed.subscribeTicker('spot', 'btcusdt', listener);
    connected();
    expect([...fake.subscriptions.keys()]).toEqual([
      '/topic/ticker.SPOT.BTCUSDT',
    ]);
    fake.send(
      '/topic/ticker.SPOT.BTCUSDT',
      JSON.stringify(OVERVIEW.tickers[0]),
    );
    expect(listener.mock.lastCall?.[0]).toMatchObject({
      symbol: 'BTCUSDT',
      lastPrice: '63000.01',
    });
  });

  it('routes a series to its kline topic', () => {
    const { feed, fake, connected } = setup();
    const listener = vi.fn();
    feed.subscribeKline('futures', 'btcusdt', '4h', listener);
    connected();
    expect([...fake.subscriptions.keys()]).toEqual([
      '/topic/kline.FUTURES.BTCUSDT.4h',
    ]);
    fake.send(
      '/topic/kline.FUTURES.BTCUSDT.4h',
      JSON.stringify({
        market: 'FUTURES',
        symbol: 'BTCUSDT',
        timeframe: '4h',
        openTime: '2026-10-03T00:00:00Z',
        closeTime: '2026-10-03T03:59:59.999Z',
        open: '1',
        high: '2',
        low: '0.5',
        close: '1.5',
        baseVolume: '3',
        quoteVolume: '4.5',
        closed: true,
        sourceTime: '2026-10-03T04:00:00Z',
      }),
    );
    expect(listener.mock.lastCall?.[0]).toMatchObject({
      market: 'futures',
      closed: true,
      candle: { close: '1.5' },
    });
  });

  it('reopens a socket that has gone silent, waiting longer each time', () => {
    const { feed, fake, connected, time } = setup();
    feed.subscribeOverview('spot', vi.fn());
    connected();
    const tick = () =>
      fake.send('/topic/overview.SPOT', JSON.stringify(OVERVIEW));

    // Messages keep it alive.
    for (let i = 0; i < 10; i++) {
      time.advance(5_000);
      tick();
    }
    expect(fake.connection.forceDisconnect).not.toHaveBeenCalled();

    // Half-open: nothing arrives for the limit, so it is closed and reopened.
    time.advance(SILENCE_LIMIT_MS);
    expect(fake.connection.forceDisconnect).toHaveBeenCalledTimes(1);
    expect(feed.status()).toBe('connecting');
    connected();
    expect(feed.status()).toBe('open');

    // Still silent after the reconnect: the next limit is twice as long.
    time.advance(SILENCE_LIMIT_MS);
    expect(fake.connection.forceDisconnect).toHaveBeenCalledTimes(1);
    time.advance(SILENCE_LIMIT_MS);
    expect(fake.connection.forceDisconnect).toHaveBeenCalledTimes(2);

    // A message brings the limit back to the start.
    connected();
    tick();
    time.advance(SILENCE_LIMIT_MS);
    expect(fake.connection.forceDisconnect).toHaveBeenCalledTimes(3);
  });

  it('does not judge a feed that carries only quiet topics, nor a closed one', () => {
    const { feed, fake, connected, time } = setup();
    const stop = feed.subscribeKline('spot', 'btcusdt', '1d', vi.fn());
    connected();
    time.advance(10 * SILENCE_LIMIT_MS);
    expect(fake.connection.forceDisconnect).not.toHaveBeenCalled();
    stop();
    expect(time.watching()).toBe(0);
  });

  it('unsubscribes and closes the socket with the last subscriber', () => {
    const { feed, fake, connected } = setup();
    const statuses: string[] = [];
    feed.onStatus(() => statuses.push(feed.status()));
    const stop = feed.subscribeOverview('spot', vi.fn());
    connected();
    stop();
    stop();
    expect(fake.unsubscribed).toEqual(['/topic/overview.SPOT']);
    expect(fake.connection.deactivate).toHaveBeenCalledTimes(1);
    expect(statuses).toEqual(['connecting', 'open', 'closed']);
  });
});

describe('signed-in STOMP client (TR-08)', () => {
  it('presents the current token in each CONNECT frame, none when signed out', async () => {
    let token: string | null = 'access-1';
    const client = signedInStompClient(async () => token)(
      'ws://localhost/ws',
    ) as unknown as {
      beforeConnect: (client: unknown) => Promise<void>;
      connectHeaders: Record<string, string>;
    };
    await client.beforeConnect(client);
    expect(client.connectHeaders).toEqual({ Authorization: 'Bearer access-1' });
    token = 'access-2';
    await client.beforeConnect(client);
    expect(client.connectHeaders).toEqual({ Authorization: 'Bearer access-2' });
    token = null;
    await client.beforeConnect(client);
    expect(client.connectHeaders).toEqual({});
  });
});
