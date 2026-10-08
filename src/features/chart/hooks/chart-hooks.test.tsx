// @vitest-environment jsdom
import type { PropsWithChildren } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createQueryClient } from '../../../app/providers/query-client';
import { ServicesContext } from '../../../app/providers/services-context';
import type {
  FeedStatus,
  MarketFeed,
  MarketService,
} from '../../../services/api/contracts';
import type { Services } from '../../../services/api/services';
import type { Candle, KlineUpdate } from '../../../types/domain';
import { useChartPreferences } from './use-chart-preferences';
import {
  HISTORY_CANDLES,
  VISIBLE_CANDLES,
  useChartSeries,
} from './use-chart-series';

const HOUR = 3_600_000;
const START = Date.UTC(2026, 9, 1);

const candle = (index: number, close = 100 + index): Candle => ({
  openTime: new Date(START + index * HOUR).toISOString(),
  open: String(close),
  high: String(close + 1),
  low: String(close - 1),
  close: String(close),
  baseVolume: '10',
  quoteVolume: '1000',
});

function setup(count: number) {
  let status: FeedStatus = 'open';
  const statusListeners = new Set<() => void>();
  let kline: ((update: KlineUpdate) => void) | null = null;
  const getCandles = vi.fn<MarketService['getCandles']>(async () =>
    Array.from({ length: count }, (_, i) => candle(i)),
  );
  const feed: MarketFeed = {
    status: () => status,
    onStatus: (listener) => {
      statusListeners.add(listener);
      return () => statusListeners.delete(listener);
    },
    subscribeOverview: () => () => undefined,
    subscribeKline: (_m, _s, _t, listener) => {
      kline = listener;
      return () => {
        kline = null;
      };
    },
  };
  const services = {
    market: { listPairs: vi.fn(), getTicker: vi.fn(), getCandles },
    marketFeed: feed,
  } as unknown as Services;
  const client = createQueryClient();
  const wrapper = ({ children }: PropsWithChildren) => (
    <ServicesContext.Provider value={services}>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </ServicesContext.Provider>
  );
  const hook = renderHook(() => useChartSeries('spot', 'BTCUSDT', '1h'), {
    wrapper,
  });
  const push = (index: number, closed: boolean, close?: number) =>
    act(() =>
      kline?.({
        market: 'spot',
        symbol: 'BTCUSDT',
        timeframe: '1h',
        closed,
        candle: candle(index, close),
      }),
    );
  const setStatus = (next: FeedStatus) =>
    act(() => {
      status = next;
      statusListeners.forEach((listener) => listener());
    });
  return { hook, push, setStatus, getCandles };
}

describe('useChartSeries', () => {
  it('reads 1,000 candles, shows 500 and aligns the indicators with them', async () => {
    const { hook, getCandles } = setup(HISTORY_CANDLES);
    await waitFor(() => expect(hook.result.current.status).toBe('ready'));
    expect(getCandles).toHaveBeenCalledWith(
      expect.objectContaining({ timeframe: '1h', limit: HISTORY_CANDLES }),
    );
    const { candles, indicators } = hook.result.current;
    expect(candles).toHaveLength(VISIBLE_CANDLES);
    expect(candles[0]?.openTime).toBe(candle(500).openTime);
    expect(indicators?.ema200).toHaveLength(VISIBLE_CANDLES);
    // Warmed up on the hidden 500: EMA200 has a value on the first visible candle.
    expect(indicators?.ema200[0]).not.toBeNull();
  });

  it('keeps the forming candle apart and moves it into history once closed', async () => {
    const { hook, push } = setup(30);
    await waitFor(() => expect(hook.result.current.status).toBe('ready'));
    push(30, false, 140);
    expect(hook.result.current.forming?.close).toBe('140');
    expect(hook.result.current.candles).toHaveLength(30);
    push(29, false, 1);
    expect(hook.result.current.forming?.close).toBe('140');
    push(30, true, 141);
    expect(hook.result.current.forming).toBeNull();
    expect(hook.result.current.candles).toHaveLength(31);
    expect(hook.result.current.candles[30]?.close).toBe('141');
    expect(hook.result.current.indicators?.sma20).toHaveLength(31);
  });

  it('reads the history again after a reconnect', async () => {
    const { hook, setStatus, getCandles } = setup(30);
    await waitFor(() => expect(hook.result.current.status).toBe('ready'));
    setStatus('connecting');
    setStatus('open');
    await waitFor(() => expect(getCandles).toHaveBeenCalledTimes(2));
  });
});

describe('useChartPreferences (remembered on the device)', () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('shows everything at first and remembers a hidden item', () => {
    const first = renderHook(() => useChartPreferences());
    expect(Object.values(first.result.current.toggles).every(Boolean)).toBe(
      true,
    );
    act(() => first.result.current.toggle('macd'));
    expect(first.result.current.toggles.macd).toBe(false);
    const again = renderHook(() => useChartPreferences());
    expect(again.result.current.toggles.macd).toBe(false);
    expect(again.result.current.toggles.rsi).toBe(true);
  });

  it('still toggles when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const hook = renderHook(() => useChartPreferences());
    act(() => hook.result.current.toggle('rsi'));
    expect(hook.result.current.toggles.rsi).toBe(false);
  });
});
