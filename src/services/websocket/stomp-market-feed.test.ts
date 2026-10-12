import { describe, expect, it, vi } from 'vitest';
import type { MarketOverview } from '../../types/domain';
import {
  createStompMarketFeed,
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
  };
  const send = (destination: string, body: string) =>
    subscriptions.get(destination)?.({ body });
  return { connection, subscriptions, unsubscribed, send };
}

function setup() {
  const fake = fakeConnection();
  const connect = vi.fn(() => fake.connection as unknown as StompConnection);
  const feed = createStompMarketFeed('ws://localhost:8080/ws', connect);
  const connected = () =>
    (fake.connection.onConnect as unknown as () => void)();
  const dropped = () =>
    (fake.connection.onWebSocketClose as unknown as () => void)();
  return { feed, fake, connect, connected, dropped };
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
