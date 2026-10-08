import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { useQuery } from '@tanstack/react-query';
import { useServices } from '../../../hooks/use-services';
import type {
  Candle,
  CandleTimeframe,
  KlineUpdate,
  MarketType,
} from '../../../types/domain';
import {
  bollinger,
  ema,
  macd,
  rsi,
  sma,
  type BollingerSeries,
  type MacdSeries,
  type Series,
} from '../indicators/indicators';

/** SRS 3.3.2 shows the latest 500 closed candles. */
export const VISIBLE_CANDLES = 500;
/**
 * Read 1,000 so the slow indicators are warmed up before the first visible
 * candle: EMA200's seed weighs about 3.5·10⁻⁴ after 800 more candles,
 * as on the server (TECHNICAL_DESIGN 7.2).
 */
export const HISTORY_CANDLES = 1000;

export interface ChartIndicators {
  sma20: Series;
  ema20: Series;
  ema50: Series;
  ema200: Series;
  bollinger: BollingerSeries;
  volumeSma20: Series;
  rsi14: Series;
  macd: MacdSeries;
}

export interface ChartSeries {
  status: 'loading' | 'error' | 'ready';
  error: unknown;
  retry: () => void;
  /** Closed candles on screen, oldest first. */
  candles: readonly Candle[];
  /** The forming candle (provisional), newer than the last closed one. */
  forming: Candle | null;
  /** Aligned with `candles`; null where a seed is incomplete. */
  indicators: ChartIndicators | null;
}

const after = (a: Candle, b: Candle | undefined) =>
  !b || Date.parse(a.openTime) > Date.parse(b.openTime);

interface Live {
  key: string;
  closed: Candle[];
  forming: Candle | null;
}

/**
 * Closed candles from REST plus the kline topic: a closed kline is added
 * after the history, the forming one is kept apart (SRS 3.3.2). After a
 * reconnect the history is read again to fill the gap. Indicator series
 * are computed over every closed candle (D-92) and cut to the visible
 * window.
 */
export function useChartSeries(
  market: MarketType,
  symbol: string,
  timeframe: CandleTimeframe,
): ChartSeries {
  const { market: service, marketFeed } = useServices();
  const key = `${market}.${symbol}.${timeframe}`;
  const history = useQuery({
    queryKey: ['market', 'candles', market, symbol, timeframe, HISTORY_CANDLES],
    queryFn: ({ signal }) =>
      service.getCandles({
        market,
        symbol,
        timeframe,
        limit: HISTORY_CANDLES,
        signal,
      }),
    staleTime: 60_000,
  });

  const [live, setLive] = useState<Live>({ key, closed: [], forming: null });
  if (live.key !== key) setLive({ key, closed: [], forming: null });

  useEffect(
    () =>
      marketFeed.subscribeKline(
        market,
        symbol,
        timeframe,
        (update: KlineUpdate) =>
          setLive((current) => {
            if (current.key !== key) return current;
            if (!update.closed)
              return after(update.candle, current.forming ?? undefined) ||
                current.forming?.openTime === update.candle.openTime
                ? { ...current, forming: update.candle }
                : current;
            const closed = current.closed.filter(
              (candle) => candle.openTime !== update.candle.openTime,
            );
            closed.push(update.candle);
            const forming =
              current.forming?.openTime === update.candle.openTime
                ? null
                : current.forming;
            return { ...current, closed, forming };
          }),
      ),
    [market, symbol, timeframe, key, marketFeed],
  );

  // A reconnect may have skipped closed candles: read the history again.
  const status = useSyncExternalStore(
    marketFeed.onStatus,
    marketFeed.status,
    marketFeed.status,
  );
  const previous = useRef(status);
  const { refetch } = history;
  useEffect(() => {
    const wasDown = previous.current !== 'open';
    previous.current = status;
    if (status === 'open' && wasDown) void refetch();
  }, [status, refetch]);

  const all = useMemo(() => {
    const stored = history.data ?? [];
    const last = stored[stored.length - 1];
    const newer = (live.key === key ? live.closed : []).filter((candle) =>
      after(candle, last),
    );
    return [...stored, ...newer];
  }, [history.data, live, key]);

  const indicators = useMemo((): ChartIndicators | null => {
    if (all.length === 0) return null;
    const closes = all.map((candle) => Number(candle.close));
    const volumes = all.map((candle) => Number(candle.baseVolume));
    const from = Math.max(0, all.length - VISIBLE_CANDLES);
    const cut = (series: Series) => series.slice(from);
    const bands = bollinger(closes);
    const lines = macd(closes);
    return {
      sma20: cut(sma(closes, 20)),
      ema20: cut(ema(closes, 20)),
      ema50: cut(ema(closes, 50)),
      ema200: cut(ema(closes, 200)),
      bollinger: {
        upper: cut(bands.upper),
        middle: cut(bands.middle),
        lower: cut(bands.lower),
      },
      volumeSma20: cut(sma(volumes, 20)),
      rsi14: cut(rsi(closes)),
      macd: {
        line: cut(lines.line),
        signal: cut(lines.signal),
        histogram: cut(lines.histogram),
      },
    };
  }, [all]);

  const lastClosed = all[all.length - 1];
  const forming =
    live.key === key && live.forming && after(live.forming, lastClosed)
      ? live.forming
      : null;

  return {
    status: history.isPending ? 'loading' : history.isError ? 'error' : 'ready',
    error: history.error,
    retry: () => void refetch(),
    candles: all.slice(-VISIBLE_CANDLES),
    forming,
    indicators,
  };
}
