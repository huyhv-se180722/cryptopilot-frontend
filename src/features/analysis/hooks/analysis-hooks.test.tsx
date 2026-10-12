// @vitest-environment jsdom
import type { PropsWithChildren } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryClient } from '../../../app/providers/query-client';
import { ServicesContext } from '../../../app/providers/services-context';
import type {
  AnalysisService,
  FeedStatus,
  MarketFeed,
} from '../../../services/api/contracts';
import type { Services } from '../../../services/api/services';
import type {
  CandleTimeframe,
  KlineUpdate,
  MarketTicker,
  PairAnalysis,
} from '../../../types/domain';
import { REFRESH_AFTER_CLOSE_MS, usePairAnalysis } from './use-pair-analysis';
import { useLiveTicker } from './use-live-ticker';

function setup(status: FeedStatus = 'open') {
  const klines = new Map<CandleTimeframe, (update: KlineUpdate) => void>();
  let ticker: ((value: MarketTicker) => void) | null = null;
  const feed: MarketFeed = {
    status: () => status,
    onStatus: () => () => undefined,
    subscribeOverview: () => () => undefined,
    subscribeTicker: (_m, _s, listener) => {
      ticker = listener;
      return () => undefined;
    },
    subscribeKline: (_m, _s, tf, listener) => {
      klines.set(tf, listener);
      return () => klines.delete(tf);
    },
  };
  // Fake-clock time of each read, to check a refresh is never early.
  const readAt: number[] = [];
  // The score is read on 1h whatever the chart's timeframe (D-53).
  const get = vi.fn<AnalysisService['get']>(
    async (market, symbol, timeframe) => {
      readAt.push(Date.now());
      return {
        symbol,
        market,
        timeframe,
        openTime: null,
        indicators: {},
        nearestSupport: null,
        nearestResistance: null,
        setupScore: {
          score: 50,
          preset: 'DAY_TRADING',
          presetVersion: 'v1',
          timeframe: '1h',
          openTime: null,
          components: {
            formulaVersion: 'v1',
            trend: null,
            momentum: null,
            volume: null,
            level: null,
          },
        },
      } as unknown as PairAnalysis;
    },
  );
  const getTicker = vi.fn(async (): Promise<MarketTicker> => ({
    market: 'spot',
    symbol: 'BTCUSDT',
    sourceTime: new Date().toISOString(),
    lastPrice: '1',
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
  }));
  const services = {
    analysis: { get },
    market: { listPairs: vi.fn(), getCandles: vi.fn(), getTicker },
    marketFeed: feed,
  } as unknown as Services;
  const client = createQueryClient();
  const wrapper = ({ children }: PropsWithChildren) => (
    <ServicesContext.Provider value={services}>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </ServicesContext.Provider>
  );
  const close = (tf: CandleTimeframe) =>
    act(() =>
      klines.get(tf)?.({
        market: 'spot',
        symbol: 'BTCUSDT',
        timeframe: tf,
        closed: true,
        candle: {
          openTime: '2026-10-09T09:00:00Z',
          open: '1',
          high: '1',
          low: '1',
          close: '1',
          baseVolume: '1',
          quoteVolume: '1',
        },
      }),
    );
  return {
    wrapper,
    get,
    readAt,
    getTicker,
    klines,
    close,
    push: (v: MarketTicker) => act(() => ticker?.(v)),
  };
}

describe('usePairAnalysis', () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => vi.useRealTimers());

  it('reads again 12 s after a closed candle of the chart or the score timeframe', async () => {
    const { wrapper, get, readAt, klines, close } = setup();
    const hook = renderHook(() => usePairAnalysis('spot', 'BTCUSDT', '4h'), {
      wrapper,
    });
    await waitFor(() => expect(hook.result.current.data).toBeDefined());
    // The dev score is on 1h: both series are followed.
    await waitFor(() =>
      expect([...klines.keys()].sort()).toEqual(['1h', '4h']),
    );
    expect(get).toHaveBeenCalledTimes(1);
    close('1h');
    const closedAt = Date.now();
    // The fake clock also follows real time (shouldAdvanceTime), so a busy
    // machine may move it on between two lines: assert the refresh is never
    // early instead of counting calls at an exact instant.
    await act(() => vi.advanceTimersByTimeAsync(REFRESH_AFTER_CLOSE_MS));
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
    expect(readAt[1]! - closedAt).toBeGreaterThanOrEqual(
      REFRESH_AFTER_CLOSE_MS,
    );
  });

  it('ignores a forming candle', async () => {
    const { wrapper, get, klines } = setup();
    const hook = renderHook(() => usePairAnalysis('spot', 'BTCUSDT', '1h'), {
      wrapper,
    });
    await waitFor(() => expect(hook.result.current.data).toBeDefined());
    act(() =>
      klines.get('1h')?.({
        market: 'spot',
        symbol: 'BTCUSDT',
        timeframe: '1h',
        closed: false,
        candle: {
          openTime: '2026-10-09T10:00:00Z',
          open: '1',
          high: '1',
          low: '1',
          close: '1',
          baseVolume: '1',
          quoteVolume: '1',
        },
      }),
    );
    await act(() => vi.advanceTimersByTimeAsync(REFRESH_AFTER_CLOSE_MS * 2));
    expect(get).toHaveBeenCalledTimes(1);
  });
});

describe('useLiveTicker (CR-09)', () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => vi.useRealTimers());

  it('is live on stream messages', () => {
    const { wrapper, push } = setup('open');
    const hook = renderHook(() => useLiveTicker('spot', 'BTCUSDT'), {
      wrapper,
    });
    expect(hook.result.current.freshness).toBe('connecting');
    push({
      market: 'spot',
      symbol: 'BTCUSDT',
      sourceTime: new Date().toISOString(),
      lastPrice: '63000.01',
      bestBid: '63000.00',
      bestAsk: '63000.01',
      high24h: null,
      low24h: null,
      changePercent24h: '1.2',
      baseVolume24h: null,
      quoteVolume24h: null,
      markPrice: null,
      indexPrice: null,
      fundingRate: null,
      nextFundingTime: null,
    });
    expect(hook.result.current.freshness).toBe('live');
    expect(hook.result.current.ticker?.bestAsk).toBe('63000.01');
  });

  it('polls the snapshot every 10 s without a socket', async () => {
    const { wrapper, getTicker } = setup('unavailable');
    const hook = renderHook(() => useLiveTicker('spot', 'BTCUSDT'), {
      wrapper,
    });
    await waitFor(() => expect(hook.result.current.ticker).not.toBeNull());
    expect(hook.result.current.freshness).toBe('delayed');
    await act(() => vi.advanceTimersByTimeAsync(10_000));
    expect(getTicker).toHaveBeenCalledTimes(2);
  });
});
