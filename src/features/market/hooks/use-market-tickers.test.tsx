// @vitest-environment jsdom
import type { PropsWithChildren } from 'react';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ServicesContext } from '../../../app/providers/services-context';
import type {
  FeedStatus,
  MarketFeed,
  MarketService,
} from '../../../services/api/contracts';
import type { Services } from '../../../services/api/services';
import type { MarketOverview, MarketTicker } from '../../../types/domain';
import { useMarketTickers } from './use-market-tickers';

const SYMBOLS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map((s) => s + 'USDT');

const ticker = (
  symbol: string,
  lastPrice: string,
  sourceTime = '2026-10-09T00:00:00Z',
): MarketTicker => ({
  market: 'spot',
  symbol,
  sourceTime,
  lastPrice,
  bestBid: null,
  bestAsk: null,
  high24h: null,
  low24h: null,
  changePercent24h: null,
  baseVolume24h: null,
  quoteVolume24h: null,
  markPrice: null,
  indexPrice: null,
  fundingRate: null,
  nextFundingTime: null,
});

/** A feed the test drives: status and overview messages on demand. */
function controllableFeed(initial: FeedStatus) {
  let status = initial;
  const statusListeners = new Set<() => void>();
  const listeners = new Set<(overview: MarketOverview) => void>();
  const feed: MarketFeed = {
    status: () => status,
    onStatus: (listener) => {
      statusListeners.add(listener);
      return () => statusListeners.delete(listener);
    },
    subscribeTicker: () => () => undefined,
    subscribeKline: () => () => undefined,
    subscribeOverview: (_market, listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return {
    feed,
    setStatus(next: FeedStatus) {
      status = next;
      statusListeners.forEach((listener) => listener());
    },
    publish(tickers: MarketTicker[]) {
      listeners.forEach((listener) =>
        listener({ market: 'spot', serverTime: 'x', tickers }),
      );
    },
  };
}

function setup(initial: FeedStatus) {
  const control = controllableFeed(initial);
  const getTicker = vi.fn<MarketService['getTicker']>(async (_m, symbol) =>
    ticker(symbol, '1.00', new Date().toISOString()),
  );
  const services = {
    market: {
      listPairs: vi.fn(),
      getCandles: vi.fn(),
      getTicker,
    },
    marketFeed: control.feed,
  } as unknown as Services;
  const wrapper = ({ children }: PropsWithChildren) => (
    <ServicesContext.Provider value={services}>
      {children}
    </ServicesContext.Provider>
  );
  const hook = renderHook(() => useMarketTickers('spot', SYMBOLS), {
    wrapper,
  });
  return { ...control, getTicker, hook };
}

const polled = (getTicker: ReturnType<typeof setup>['getTicker']) =>
  getTicker.mock.calls.map((call) => call[1]);

describe('useMarketTickers (CR-09)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('is live on stream messages and keeps only newer tickers of its market', () => {
    const { hook, publish, getTicker } = setup('open');
    expect(hook.result.current.freshness).toBe('connecting');
    act(() =>
      publish([
        ticker('AUSDT', '2.00', '2026-10-09T00:00:05Z'),
        { ...ticker('ZUSDT', '9.00'), market: 'futures' },
      ]),
    );
    act(() => publish([ticker('AUSDT', '1.50', '2026-10-09T00:00:01Z')]));
    expect(hook.result.current.freshness).toBe('live');
    expect(hook.result.current.tickers.get('AUSDT')?.lastPrice).toBe('2.00');
    expect(hook.result.current.tickers.has('ZUSDT')).toBe(false);
    expect(getTicker).not.toHaveBeenCalled();
  });

  it('turns Delayed after 10 s of silence and polls six pairs per round in turn', async () => {
    const { hook, publish, getTicker } = setup('open');
    act(() => publish([ticker('AUSDT', '2.00')]));
    await act(() => vi.advanceTimersByTimeAsync(11_000));
    expect(hook.result.current.freshness).toBe('delayed');
    expect(polled(getTicker)).toEqual(SYMBOLS.slice(0, 6));
    await act(() => vi.advanceTimersByTimeAsync(10_000));
    expect(polled(getTicker).slice(6)).toEqual([
      'GUSDT',
      'HUSDT',
      'AUSDT',
      'BUSDT',
      'CUSDT',
      'DUSDT',
    ]);
    expect(hook.result.current.tickers.get('BUSDT')?.lastPrice).toBe('1.00');
  });

  it('is Delayed at once without a socket, and live again on the next message', async () => {
    const { hook, publish, setStatus, getTicker } = setup('unavailable');
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(hook.result.current.freshness).toBe('delayed');
    expect(getTicker).toHaveBeenCalledTimes(6);
    act(() => setStatus('open'));
    act(() => publish([ticker('AUSDT', '3.00', new Date().toISOString())]));
    await act(() => vi.advanceTimersByTimeAsync(1_000));
    expect(hook.result.current.freshness).toBe('live');
    await act(() => vi.advanceTimersByTimeAsync(9_000));
    expect(getTicker).toHaveBeenCalledTimes(6);
  });
});
