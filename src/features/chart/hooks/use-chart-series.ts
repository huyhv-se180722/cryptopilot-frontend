import {
  useCallback,
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
/** Candles read per step when an extendable chart is dragged to its start. */
export const OLDER_PAGE = 500;

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
  /** Extendable only: reads the page before the oldest candle shown. */
  loadOlder: (() => void) | null;
  loadingOlder: boolean;
}

const after = (a: Candle, b: Candle | undefined) =>
  !b || Date.parse(a.openTime) > Date.parse(b.openTime);

interface Live {
  key: string;
  closed: Candle[];
  forming: Candle | null;
}

interface Older {
  key: string;
  /** Earlier pages plus the history they were read against. */
  candles: readonly Candle[];
  loading: boolean;
  /** The backend returned a short page: nothing older is stored. */
  exhausted: boolean;
}

const noOlder = (key: string): Older => ({
  key,
  candles: [],
  loading: false,
  exhausted: false,
});

/** One candle per open time, oldest first. */
function merge(...lists: (readonly Candle[])[]): Candle[] {
  const byTime = new Map<string, Candle>();
  for (const list of lists)
    for (const candle of list) byTime.set(candle.openTime, candle);
  return [...byTime.values()].sort(
    (a, b) => Date.parse(a.openTime) - Date.parse(b.openTime),
  );
}

/**
 * Closed candles from REST plus the kline topic: a closed kline is added
 * after the history, the forming one is kept apart (SRS 3.3.2). After a
 * reconnect the history is read again to fill the gap. Indicator series
 * are computed over every closed candle (D-96) and cut to the visible
 * window. An `extendable` chart (the trading screens) shows every candle
 * it has and reads earlier pages on demand (`loadOlder`); SCR-10 and
 * SCR-11 keep the latest 500 (SRS 3.3.2).
 */
export function useChartSeries(
  market: MarketType,
  symbol: string,
  timeframe: CandleTimeframe,
  { extendable = false }: { extendable?: boolean } = {},
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
  const [older, setOlder] = useState<Older>(() => noOlder(key));
  if (older.key !== key) setOlder(noOlder(key));
  const olderRequest = useRef<AbortController | null>(null);
  // A new pair or timeframe drops a page still on its way.
  useEffect(() => () => olderRequest.current?.abort(), [key]);

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
    const earlier = older.key === key ? older.candles : [];
    return earlier.length > 0
      ? merge(earlier, stored, newer)
      : [...stored, ...newer];
  }, [history.data, live, older, key]);

  const first = all[0];
  const canLoad =
    extendable &&
    first !== undefined &&
    older.key === key &&
    !older.loading &&
    !older.exhausted;
  const loadOlder = useCallback(() => {
    if (!canLoad) return;
    const controller = new AbortController();
    olderRequest.current?.abort();
    olderRequest.current = controller;
    const base = all;
    setOlder((current) => ({ ...current, loading: true }));
    service
      .getCandles({
        market,
        symbol,
        timeframe,
        limit: OLDER_PAGE,
        before: first.openTime,
        signal: controller.signal,
      })
      .then(
        (page) =>
          setOlder((current) =>
            current.key !== key || controller.signal.aborted
              ? current
              : {
                  key,
                  // The history read so far is kept, so a later re-read of
                  // the latest candles leaves no gap behind the pages.
                  candles: merge(page, base),
                  loading: false,
                  exhausted: page.length < OLDER_PAGE,
                },
          ),
        () =>
          // A failure leaves the chart as it is; the next drag tries again.
          setOlder((current) =>
            current.key !== key || controller.signal.aborted
              ? current
              : { ...current, loading: false },
          ),
      );
  }, [canLoad, all, first, service, market, symbol, timeframe, key]);

  const indicators = useMemo((): ChartIndicators | null => {
    if (all.length === 0) return null;
    const closes = all.map((candle) => Number(candle.close));
    const volumes = all.map((candle) => Number(candle.baseVolume));
    const from = extendable ? 0 : Math.max(0, all.length - VISIBLE_CANDLES);
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
  }, [all, extendable]);

  const lastClosed = all[all.length - 1];
  const forming =
    live.key === key && live.forming && after(live.forming, lastClosed)
      ? live.forming
      : null;

  return {
    status: history.isPending ? 'loading' : history.isError ? 'error' : 'ready',
    error: history.error,
    retry: () => void refetch(),
    candles: extendable ? all : all.slice(-VISIBLE_CANDLES),
    forming,
    indicators,
    loadOlder: extendable ? loadOlder : null,
    loadingOlder: older.key === key && older.loading,
  };
}
