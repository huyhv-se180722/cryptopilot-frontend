import { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import {
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  createChart,
  createSeriesMarkers,
  type CandlestickData,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type Time,
  type SeriesType,
  type UTCTimestamp,
} from 'lightweight-charts';
import { ErrorState } from '../../../components/feedback/States';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { Skeleton } from '../../../components/ui/Skeleton';
import { useCopy } from '../../../hooks/use-copy';
import { formatCopy } from '../../../i18n/copy';
import { errorText } from '../../../i18n/messages';
import type {
  Candle,
  CandleTimeframe,
  Decimal,
  MarketType,
} from '../../../types/domain';
import { classNames } from '../../../utils/class-names';
import { decimalPlaces } from '../../../utils/decimal-format';
import {
  CHART_ITEMS,
  useChartPreferences,
  type ChartItem,
  type ChartToggles,
} from '../hooks/use-chart-preferences';
import {
  useChartSeries,
  type ChartIndicators,
} from '../hooks/use-chart-series';
import type { Series } from '../indicators/indicators';
import { chartOptions, token, useThemeVersion } from './chart-theme';
import { chartOffsetSeconds, chartTime, zoneLabel } from './chart-time';
import {
  TONE_TOKENS,
  placeMarkers,
  type ChartMarker,
  type ChartTone,
} from './chart-markers';

export type { ChartMarker } from './chart-markers';

const TIMEFRAMES: readonly CandleTimeframe[] = ['15m', '1h', '4h', '1d'];
/** An extendable chart opens on the latest bars, like an exchange chart. */
const OPENING_BARS = 150;
/** Bars left of the view at which an extendable chart reads an older page. */
const LOAD_MARGIN_BARS = 30;
/** Price pane 320px plus 110px per shown panel. */
const HEIGHTS = ['h-[320px]', 'h-[430px]', 'h-[540px]', 'h-[650px]'] as const;

/** Which design token draws each line, so both themes follow. */
const LINE_TOKENS = {
  sma20: '--cp-muted',
  ema20: '--cp-primary',
  ema50: '--cp-accent',
  ema200: '--cp-purple',
  bollinger: '--cp-warning',
  volumeSma: '--cp-muted',
  rsi: '--cp-purple',
  macdLine: '--cp-primary',
  macdSignal: '--cp-warning',
} as const;

/** A candle's place on the time axis (see `chart-time.ts`). */
type TimeOf = (candle: Candle) => UTCTimestamp;

function line(time: TimeOf, candles: readonly Candle[], values: Series) {
  return candles.map((candle, i) => {
    const value = values[i];
    return value === null || value === undefined
      ? { time: time(candle) }
      : { time: time(candle), value };
  });
}

interface Data {
  candles: readonly Candle[];
  forming: Candle | null;
  indicators: ChartIndicators | null;
}

/**
 * Builds the chart for the shown items: the price pane with the overlays,
 * then one pane per shown panel (Volume, RSI, MACD). Returns a function
 * that writes the data into the series it created.
 */
export interface PriceLevels {
  support: string | null;
  resistance: string | null;
}

/**
 * A labelled horizontal line on the price pane: a BR-14 level, or later an
 * order, an entry, a TP/SL or a liquidation price. `id` keeps it stable.
 */
export interface ChartPriceLine {
  id: string;
  price: Decimal;
  label: string;
  tone: ChartTone;
  dashed?: boolean;
  /**
   * A button for the line, e.g. cancel an order. The line's label then
   * shows as a chip at the pane's left edge with the button in it (as the
   * exchange charts do), instead of beside the axis.
   */
  action?: ChartLineAction;
}
export interface ChartLineAction {
  /** Accessible name and tooltip of the button. */
  label: string;
  onSelect: () => void;
  disabled?: boolean;
}

/** A caller's item in the chart's toggle group, styled as the indicators. */
export interface ChartExtraItem {
  id: string;
  label: string;
  pressed: boolean;
  onToggle: () => void;
}

/** Where a line's chip sits: its y on the price pane. */
interface Anchor {
  id: string;
  y: number;
}

const CHIP_TONES: Record<ChartTone, string> = {
  positive: 'border-positive-line text-positive',
  negative: 'border-negative-line text-negative',
  neutral: 'border-line text-muted',
  primary: 'border-primary-line text-primary',
  warning: 'border-warning-line text-warning',
};

/** Replaces the lines drawn on `series` with `lines`; returns the new ones. */
function drawPriceLines(
  series: ISeriesApi<'Candlestick'>,
  drawn: readonly IPriceLine[],
  lines: readonly ChartPriceLine[],
): IPriceLine[] {
  drawn.forEach((line) => series.removePriceLine(line));
  return lines.map((line) =>
    series.createPriceLine({
      price: Number(line.price),
      color: token(TONE_TOKENS[line.tone]),
      lineWidth: 1,
      lineStyle: line.dashed === false ? 0 : 1,
      axisLabelVisible: true,
      // A line with an action carries its label in its chip.
      title: line.action ? '' : line.label,
    }),
  );
}

function build(
  chart: IChartApi,
  toggles: ChartToggles,
  places: number,
  time: TimeOf,
) {
  const up = token('--cp-positive');
  const down = token('--cp-negative');
  const upDim = token('--cp-positive-dim');
  const downDim = token('--cp-negative-dim');
  const lineOptions = (name: keyof typeof LINE_TOKENS, width = 1) => ({
    color: token(LINE_TOKENS[name]),
    lineWidth: width as 1 | 2,
    priceLineVisible: false,
    lastValueVisible: false,
    crosshairMarkerVisible: false,
  });
  const writers: ((data: Data) => void)[] = [];
  const minMove = places === 0 ? 1 : Number('1e-' + places);

  const candles = chart.addSeries(CandlestickSeries, {
    upColor: up,
    downColor: down,
    wickUpColor: up,
    wickDownColor: down,
    borderVisible: false,
    priceFormat: { type: 'price', precision: places, minMove },
  });
  // Provisional (SRS 3.3.2): the forming candle is drawn faded.
  const formingBar = (forming: Candle): CandlestickData<UTCTimestamp> => {
    const colour =
      Number(forming.close) >= Number(forming.open) ? upDim : downDim;
    return {
      time: time(forming),
      open: Number(forming.open),
      high: Number(forming.high),
      low: Number(forming.low),
      close: Number(forming.close),
      color: colour,
      wickColor: colour,
    };
  };
  writers.push(({ candles: closed, forming }) => {
    const bars: CandlestickData<UTCTimestamp>[] = closed.map((candle) => ({
      time: time(candle),
      open: Number(candle.open),
      high: Number(candle.high),
      low: Number(candle.low),
      close: Number(candle.close),
    }));
    if (forming) bars.push(formingBar(forming));
    candles.setData(bars);
  });

  const overlay = (
    name: 'sma20' | 'ema20' | 'ema50' | 'ema200',
    pick: (indicators: ChartIndicators) => Series,
  ) => {
    const series = chart.addSeries(LineSeries, lineOptions(name));
    writers.push(({ candles: closed, indicators }) =>
      series.setData(indicators ? line(time, closed, pick(indicators)) : []),
    );
  };
  if (toggles.sma20) overlay('sma20', (i) => i.sma20);
  if (toggles.ema20) overlay('ema20', (i) => i.ema20);
  if (toggles.ema50) overlay('ema50', (i) => i.ema50);
  if (toggles.ema200) overlay('ema200', (i) => i.ema200);
  if (toggles.bollinger)
    for (const band of ['upper', 'middle', 'lower'] as const) {
      const series = chart.addSeries(LineSeries, {
        ...lineOptions('bollinger'),
        lineStyle: band === 'middle' ? 2 : 0,
      });
      writers.push(({ candles: closed, indicators }) =>
        series.setData(
          indicators ? line(time, closed, indicators.bollinger[band]) : [],
        ),
      );
    }

  let pane = 0;
  const panes: number[] = [];
  const nextPane = () => {
    pane += 1;
    panes.push(pane);
    return pane;
  };
  const histogram = (
    index: number,
    values: (
      data: Data,
    ) => { time: UTCTimestamp; value: number; color: string }[],
  ) => {
    const series: ISeriesApi<SeriesType> = chart.addSeries(
      HistogramSeries,
      { priceLineVisible: false, lastValueVisible: false },
      index,
    );
    writers.push((data) => series.setData(values(data)));
  };
  const paneLine = (
    index: number,
    name: keyof typeof LINE_TOKENS,
    values: (indicators: ChartIndicators) => Series,
  ) => {
    const series = chart.addSeries(LineSeries, lineOptions(name), index);
    writers.push(({ candles: closed, indicators }) =>
      series.setData(indicators ? line(time, closed, values(indicators)) : []),
    );
    return series;
  };

  if (toggles.volume) {
    const index = nextPane();
    histogram(index, ({ candles: closed }) =>
      closed.map((candle) => ({
        time: time(candle),
        value: Number(candle.baseVolume),
        color: Number(candle.close) >= Number(candle.open) ? upDim : downDim,
      })),
    );
    paneLine(index, 'volumeSma', (i) => i.volumeSma20);
  }
  if (toggles.rsi) {
    const index = nextPane();
    const rsiLine = paneLine(index, 'rsi', (i) => i.rsi14);
    for (const level of [30, 70])
      rsiLine.createPriceLine({
        price: level,
        color: token('--cp-border-s'),
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: '',
      });
  }
  if (toggles.macd) {
    const index = nextPane();
    histogram(index, ({ candles: closed, indicators }) =>
      indicators
        ? closed.flatMap((candle, i) => {
            const value = indicators.macd.histogram[i];
            return value === null || value === undefined
              ? []
              : [
                  {
                    time: time(candle),
                    value,
                    color: value >= 0 ? upDim : downDim,
                  },
                ];
          })
        : [],
    );
    paneLine(index, 'macdLine', (i) => i.macd.line);
    paneLine(index, 'macdSignal', (i) => i.macd.signal);
  }

  // The price pane keeps most of the height; each panel takes a share.
  chart.panes()[0]?.setStretchFactor(3);
  for (const index of panes) chart.panes()[index]?.setStretchFactor(1);

  return {
    write: (data: Data) => writers.forEach((write) => write(data)),
    /**
     * Only the forming candle moved: change that bar alone (the library
     * replaces its last bar at the same time, or appends a later one); the
     * indicators and panels are drawn from closed candles and stay.
     */
    updateForming: (forming: Candle) => candles.update(formingBar(forming)),
    candles,
  };
}

/**
 * SCR-10 chart (SRS 3.3.2, BR-12): timeframe 15m / 1h / 4h / 1d (default
 * 1h, BR-08), the latest 500 closed candles and the forming one drawn
 * faded as provisional; overlays SMA 20, EMA 20 / 50 / 200 and Bollinger;
 * panels Volume with its SMA 20, RSI 14 and MACD. Each item can be hidden,
 * and the choice is remembered on the device. `levels` (BR-14) and
 * `priceLines` are drawn on the price pane and redrawn without a rebuild.
 * `extendable` (trading screens) opens on the latest bars and reads older
 * candles when dragged to its start, keeping the view in place.
 */
export function AnalysisChart({
  market,
  symbol,
  tickSize,
  timeframe,
  onTimeframeChange,
  levels,
  priceLines,
  markers,
  extraItems,
  extendable = false,
}: {
  market: MarketType;
  symbol: string;
  tickSize: string | null;
  timeframe: CandleTimeframe;
  onTimeframeChange: (timeframe: CandleTimeframe) => void;
  levels?: PriceLevels;
  priceLines?: readonly ChartPriceLine[];
  markers?: readonly ChartMarker[];
  extraItems?: readonly ChartExtraItem[];
  extendable?: boolean;
}) {
  const copy = useCopy();
  const c = copy.chart;
  const { toggles, toggle } = useChartPreferences();
  const series = useChartSeries(market, symbol, timeframe, { extendable });
  const chartApi = useRef<IChartApi | null>(null);
  const loadOlder = useRef(series.loadOlder);
  const firstShown = useRef<string | null>(null);
  const container = useRef<HTMLDivElement>(null);
  const write = useRef<((data: Data) => void) | null>(null);
  const updateForming = useRef<((forming: Candle) => void) | null>(null);
  /** What the series hold, to tell a forming-only change from a new list. */
  const written = useRef<Pick<Data, 'candles' | 'indicators'> | null>(null);
  const latest = useRef<Data>(series);
  const ready = series.status === 'ready';
  const togglesKey = CHART_ITEMS.map((item) => (toggles[item] ? 1 : 0)).join(
    '',
  );
  const places = decimalPlaces(tickSize);
  // Local time on intraday charts, UTC on daily ones (chart-time.ts).
  const offset = chartOffsetSeconds(timeframe);
  const time = useCallback(
    (candle: Candle) => chartTime(candle.openTime, offset),
    [offset],
  );
  const theme = useThemeVersion();
  const priceSeries = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const drawnLines = useRef<IPriceLine[]>([]);
  // BR-14: nearest support and resistance, then the caller's own lines.
  const lines: ChartPriceLine[] = [
    ...(levels?.support
      ? [
          {
            id: 'support',
            price: levels.support,
            label: copy.analysis.support,
            tone: 'positive' as const,
          },
        ]
      : []),
    ...(levels?.resistance
      ? [
          {
            id: 'resistance',
            price: levels.resistance,
            label: copy.analysis.resistance,
            tone: 'negative' as const,
          },
        ]
      : []),
    ...(priceLines ?? []),
  ];
  const linesKey = lines
    .map((line) =>
      [line.id, line.price, line.label, line.tone, line.dashed].join(':'),
    )
    .join('|');
  const latestLines = useRef(lines);
  const markersApi = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const markersKey = (markers ?? [])
    .map((marker) => [marker.id, marker.time, marker.direction].join(':'))
    .join('|');
  const latestMarkers = useRef(markers ?? []);
  const hasActions = lines.some((line) => line.action);
  const [anchors, setAnchors] = useState<readonly Anchor[]>([]);

  // Declared before the rebuild so a rebuild writes the newest data.
  useEffect(() => {
    latest.current = series;
    latestLines.current = lines;
    latestMarkers.current = markers ?? [];
    loadOlder.current = series.loadOlder;
  });

  // Rebuilt when the shown items, the precision or the theme change.
  useEffect(() => {
    if (!ready || !container.current) return;
    const chart = createChart(container.current, chartOptions());
    const built = build(chart, toggles, places, time);
    write.current = built.write;
    updateForming.current = built.updateForming;
    priceSeries.current = built.candles;
    drawnLines.current = drawPriceLines(built.candles, [], latestLines.current);
    markersApi.current = createSeriesMarkers(built.candles, []);
    write.current(latest.current);
    written.current = latest.current;
    chartApi.current = chart;
    firstShown.current = latest.current.candles[0]?.openTime ?? null;
    const scale = chart.timeScale();
    const onRange = (range: { from: number } | null) => {
      if (range && range.from < LOAD_MARGIN_BARS) loadOlder.current?.();
    };
    if (extendable) {
      const count = latest.current.candles.length;
      scale.setVisibleLogicalRange({
        from: Math.max(0, count - OPENING_BARS),
        to: count + 5,
      });
      scale.subscribeVisibleLogicalRangeChange(onRange);
    } else scale.fitContent();
    return () => {
      if (extendable) scale.unsubscribeVisibleLogicalRangeChange(onRange);
      write.current = null;
      updateForming.current = null;
      written.current = null;
      chartApi.current = null;
      priceSeries.current = null;
      drawnLines.current = [];
      markersApi.current = null;
      chart.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `toggles` is read through `togglesKey`.
  }, [ready, togglesKey, places, theme, extendable, time]);

  // Lines change often (orders, levels): redraw them on the same series.
  useEffect(() => {
    if (!priceSeries.current) return;
    drawnLines.current = drawPriceLines(
      priceSeries.current,
      drawnLines.current,
      latestLines.current,
    );
  }, [linesKey]);

  // Markers sit on bars: placed again when they, the bars or the chart change.
  const firstOpen = series.candles[0]?.openTime;
  const formingOpen = series.forming?.openTime;
  const barCount = series.candles.length;
  useEffect(() => {
    const { candles, forming } = latest.current;
    markersApi.current?.setMarkers(
      placeMarkers(
        latestMarkers.current,
        forming ? [...candles, forming] : candles,
        (tone) => token(TONE_TOKENS[tone]),
        time,
      ),
    );
  }, [
    markersKey,
    firstOpen,
    formingOpen,
    barCount,
    ready,
    togglesKey,
    places,
    theme,
    time,
  ]);

  // A line's chip follows its price while the Trader pans and zooms. The
  // chart has no event for a price scale change, so the chips are placed
  // each frame, and React renders only when one moved.
  useEffect(() => {
    if (!hasActions) return;
    let frame = 0;
    let shown = '';
    const place = () => {
      const chart = chartApi.current;
      const candles = priceSeries.current;
      const next: Anchor[] = [];
      if (chart && candles) {
        const height = chart.panes()[0]?.getHeight() ?? 0;
        for (const line of latestLines.current) {
          if (!line.action) continue;
          const y = candles.priceToCoordinate(Number(line.price));
          if (y !== null && y >= 0 && y <= height)
            next.push({ id: line.id, y: Math.round(y) });
        }
      }
      const key = next.map((at) => `${at.id}:${at.y}`).join('|');
      if (key !== shown) {
        shown = key;
        setAnchors(next);
      }
      frame = requestAnimationFrame(place);
    };
    frame = requestAnimationFrame(place);
    return () => cancelAnimationFrame(frame);
  }, [hasActions]);

  useEffect(() => {
    // The forming candle moves every couple of seconds: when nothing else
    // changed, update that one bar instead of writing every series again.
    const held = written.current;
    if (
      held &&
      series.forming &&
      updateForming.current &&
      held.candles === series.candles &&
      held.indicators === series.indicators
    ) {
      try {
        updateForming.current(series.forming);
        return;
      } catch {
        // A bar older than the last one cannot be updated: write it all.
      }
    }
    const scale = extendable ? chartApi.current?.timeScale() : undefined;
    const range = scale?.getVisibleLogicalRange() ?? null;
    write.current?.({
      candles: series.candles,
      forming: series.forming,
      indicators: series.indicators,
    });
    if (write.current)
      written.current = {
        candles: series.candles,
        indicators: series.indicators,
      };
    // Older candles were put in front: move the view by as many bars so
    // what the Trader looks at stays where it was.
    const before = firstShown.current;
    firstShown.current = series.candles[0]?.openTime ?? null;
    if (!extendable || !scale || !range || before === null) return;
    const added = series.candles.findIndex(
      (candle) => candle.openTime === before,
    );
    if (added > 0)
      scale.setVisibleLogicalRange({
        from: range.from + added,
        to: range.to + added,
      });
  }, [series.candles, series.forming, series.indicators, extendable]);

  const panels = (['volume', 'rsi', 'macd'] as const).filter(
    (item) => toggles[item],
  ).length;

  return (
    <section
      aria-label={c.itemsLabel}
      className="rounded-xl border border-line bg-surface p-3 sm:p-4"
    >
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <SegmentedControl
          label={c.timeframeLabel}
          value={timeframe}
          onChange={onTimeframeChange}
          options={TIMEFRAMES.map((value) => ({ value, label: value }))}
        />
        <div
          role="group"
          aria-label={c.itemsLabel}
          className="flex flex-wrap gap-1.5"
        >
          {CHART_ITEMS.map((item: ChartItem) => (
            <button
              key={item}
              type="button"
              aria-pressed={toggles[item]}
              onClick={() => toggle(item)}
              className={classNames(
                'h-7 rounded-full border px-2.5 text-[11px] font-medium pointer-coarse:h-9',
                toggles[item]
                  ? 'border-primary-line bg-primary-soft text-primary'
                  : 'border-line text-muted hover:text-fg-2',
              )}
            >
              {c[item]}
            </button>
          ))}
          {extraItems?.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={item.pressed}
              onClick={item.onToggle}
              className={classNames(
                'h-7 rounded-full border px-2.5 text-[11px] font-medium pointer-coarse:h-9',
                item.pressed
                  ? 'border-primary-line bg-primary-soft text-primary'
                  : 'border-line text-muted hover:text-fg-2',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        {series.loadingOlder && (
          <span role="status" className="text-[11px] text-muted">
            {c.loadingOlder}
          </span>
        )}
        <span className="ml-auto inline-flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-[11px] text-muted">
          {series.forming && (
            <span className="inline-flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="h-3 w-1.5 rounded-sm bg-positive-line"
              />
              {c.forming}
            </span>
          )}
          <span>{formatCopy(c.timeZone, { zone: zoneLabel(offset) })}</span>
        </span>
      </div>
      {series.status === 'loading' ? (
        <Skeleton className={classNames('w-full', HEIGHTS[panels])} />
      ) : series.status === 'error' ? (
        <ErrorState
          message={errorText(copy, series.error)}
          onRetry={series.retry}
        />
      ) : series.candles.length === 0 ? (
        <p className="flex h-64 items-center justify-center text-xs text-muted">
          {c.empty}
        </p>
      ) : (
        <>
          <div className="relative">
            <div
              ref={container}
              role="img"
              aria-label={formatCopy(c.chartLabel, {
                symbol,
                timeframe,
                count: series.candles.length,
              })}
              className={classNames('w-full', HEIGHTS[panels])}
            />
            {(hasActions ? anchors : []).map((anchor) => {
              const line = lines.find((each) => each.id === anchor.id);
              const action = line?.action;
              return line && action ? (
                <div
                  key={anchor.id}
                  style={{ top: anchor.y }}
                  className={classNames(
                    'absolute left-2 z-10 inline-flex -translate-y-1/2 items-center gap-1 rounded border bg-surface pl-1.5 font-mono text-[11px] leading-none',
                    CHIP_TONES[line.tone],
                  )}
                >
                  <span className="py-1">{line.label}</span>
                  <button
                    type="button"
                    aria-label={action.label}
                    title={action.label}
                    disabled={action.disabled}
                    onClick={action.onSelect}
                    className="inline-flex h-5 w-5 items-center justify-center border-l border-inherit text-muted hover:text-fg disabled:opacity-50 pointer-coarse:h-8 pointer-coarse:w-8"
                  >
                    <X size={12} aria-hidden="true" />
                  </button>
                </div>
              ) : null;
            })}
          </div>
          {series.candles.length < 200 && toggles.ema200 && (
            <p className="mt-2 text-[11px] text-muted-dim">{c.insufficient}</p>
          )}
        </>
      )}
    </section>
  );
}
