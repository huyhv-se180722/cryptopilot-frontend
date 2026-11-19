import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GripVertical, Maximize2, X } from 'lucide-react';
import { Link } from 'react-router-dom';
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
import { Skeleton } from '../../../components/ui/Skeleton';
import { useCopy, useLocale } from '../../../hooks/use-copy';
import { formatCopy } from '../../../i18n/copy';
import { errorText } from '../../../i18n/messages';
import type {
  Candle,
  CandleTimeframe,
  ChartTimeframe,
  Decimal,
  MarketType,
} from '../../../types/domain';
import { classNames } from '../../../utils/class-names';
import { decimalPlaces } from '../../../utils/decimal-format';
import { add, subtract, toStep } from '../../../utils/decimal-math';
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
import { labelsShown } from './chart-labels';
import { TimeframePicker } from './TimeframePicker';
import { ChartLayoutMenu } from '../drawing/components/ChartLayoutMenu';
import { DrawingFloatingBar } from '../drawing/components/DrawingFloatingBar';
import { DrawingTextDialog } from '../drawing/components/DrawingTextDialog';
import { DrawingToolbar } from '../drawing/components/DrawingToolbar';
import { useDrawingLayer } from '../drawing/use-drawing-layer';

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
   * Its axis label and title give way while another label (the last price,
   * a line that does not give way, or an earlier one that does) is closer
   * than one label's height; the line itself stays. For the BR-14 levels,
   * which often lie right beside the price and are listed beside the chart.
   */
  yields?: boolean;
  /**
   * A button for the line, e.g. cancel an order. The line's label then
   * shows as a chip at the pane's left edge with the button in it (as the
   * exchange charts do), instead of beside the axis.
   */
  action?: ChartLineAction;
  /**
   * The line may be dragged to a new price (TR-F5, as the exchange charts
   * move an order): its chip is the handle. Dropped, the price on the
   * pair's tick is handed to `onDrop`; the line stays where it was until
   * the caller's data moves it. From the keyboard, the handle's arrows
   * move it a tick, Enter drops it there and Escape puts it back.
   */
  drag?: ChartLineDrag;
}
export interface ChartLineDrag {
  /** Accessible name and tooltip of the handle. */
  label: string;
  onDrop: (price: Decimal) => void;
  disabled?: boolean;
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

/** RSI reads from 0 to 100 whatever the data, so 30 and 70 stay in place. */
const RSI_RANGE = () => ({ priceRange: { minValue: 0, maxValue: 100 } });

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
    extra: { autoscaleInfoProvider?: typeof RSI_RANGE } = {},
  ) => {
    const series = chart.addSeries(
      LineSeries,
      { ...lineOptions(name), ...extra },
      index,
    );
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
    const rsiLine = paneLine(index, 'rsi', (i) => i.rsi14, {
      autoscaleInfoProvider: RSI_RANGE,
    });
    // Thin margins, so the scale ends near 0 and 100 with no tick beyond.
    rsiLine.priceScale().applyOptions({
      scaleMargins: { top: 0.05, bottom: 0.05 },
    });
    // Guides without axis labels, which would cover the scale's own ticks.
    for (const level of [30, 70])
      rsiLine.createPriceLine({
        price: level,
        color: token('--cp-border-s'),
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: false,
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
 * candles when dragged to its start, keeping the view in place. `height`
 * (a height class) fixes the drawing's height, the panels sharing it with
 * the price pane, where a screen lays the chart out beside other regions.
 * `drawingPairId` turns on the Trader's drawing tools (D-149): the drawings
 * of that pair are loaded, painted and edited on the price pane.
 */
export function AnalysisChart<T extends ChartTimeframe = CandleTimeframe>({
  market,
  symbol,
  tickSize,
  timeframe,
  onTimeframeChange,
  timeframes,
  levels,
  priceLines,
  markers,
  extraItems,
  referenceBars,
  referenceLabel,
  extendable = false,
  height,
  drawingPairId,
  expandTo,
}: {
  market: MarketType;
  symbol: string;
  tickSize: string | null;
  timeframe: T;
  onTimeframeChange: (timeframe: T) => void;
  /**
   * The timeframes offered; the four stored ones (BR-08) by default. A
   * longer list (the trading chart's sixteen, TR-35) shows the common ones
   * as buttons and the rest in a list beside them, as an exchange does.
   */
  timeframes?: readonly T[];
  levels?: PriceLevels;
  priceLines?: readonly ChartPriceLine[];
  markers?: readonly ChartMarker[];
  extraItems?: readonly ChartExtraItem[];
  /**
   * Display-only reference bars of another venue while the exchange's data
   * is lost (D-159): drawn in their own colour after the exchange's last
   * bar, labelled with `referenceLabel`, never mixed into the indicators.
   */
  referenceBars?: readonly Candle[];
  referenceLabel?: string;
  extendable?: boolean;
  height?: string;
  drawingPairId?: string;
  /** The Chart screen of the pair, linked from the header. */
  expandTo?: string;
}) {
  const copy = useCopy();
  const locale = useLocale();
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
  const seconds = timeframe === '1s';
  const time = useCallback(
    (candle: Candle) => chartTime(candle.openTime, offset),
    [offset],
  );
  const theme = useThemeVersion();
  const priceSeries = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const referenceSeries = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const latestReference = useRef<readonly Candle[]>(referenceBars ?? []);
  const referenceKey = (referenceBars ?? [])
    .map((bar) =>
      [bar.openTime, bar.open, bar.high, bar.low, bar.close].join(':'),
    )
    .join('|');
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
            yields: true,
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
            yields: true,
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
  const hasActions = lines.some((line) => line.action || line.drag);
  /** The line being moved and where to: drawn there until dropped. */
  const dragging = useRef<{ id: string; price: Decimal } | null>(null);
  const [draggingPrice, setDraggingPrice] = useState<{
    id: string;
    price: Decimal;
  } | null>(null);
  const tick =
    tickSize ?? (places === 0 ? '1' : '0.' + '0'.repeat(places - 1) + '1');
  const moveTo = (next: { id: string; price: Decimal } | null) => {
    dragging.current = next;
    setDraggingPrice(next);
  };
  const pointer = useRef<{ id: string; startY: number; moved: boolean } | null>(
    null,
  );
  const priceAt = (clientY: number): Decimal | null => {
    const candles = priceSeries.current;
    const box = container.current?.getBoundingClientRect();
    if (!candles || !box) return null;
    const value = candles.coordinateToPrice(clientY - box.top);
    if (value === null || !Number.isFinite(value) || value <= 0) return null;
    return toStep(String(value), tick, 'half-up');
  };
  const hasYielding = lines.some((line) => line.yields);
  const [anchors, setAnchors] = useState<readonly Anchor[]>([]);
  const bars = useMemo(
    () =>
      series.forming ? [...series.candles, series.forming] : series.candles,
    [series.candles, series.forming],
  );
  const layer = useDrawingLayer({
    pairId: drawingPairId,
    bars,
    timeframe,
    offset,
    // Without a tick size, enough decimals for the smallest prices.
    places: tickSize === null ? 8 : places,
  });
  const drawingsOn = Boolean(drawingPairId) && layer.status === 'success';
  const { attach } = layer;
  const detachLayer = useRef<(() => void) | null>(null);

  // Declared before the rebuild so a rebuild writes the newest data.
  useEffect(() => {
    latest.current = series;
    latestLines.current = lines;
    latestMarkers.current = markers ?? [];
    latestReference.current = referenceBars ?? [];
    loadOlder.current = series.loadOlder;
  });

  // Rebuilt when the shown items, the precision, the theme or the locale change.
  useEffect(() => {
    if (!ready || !container.current) return;
    const chart = createChart(container.current, chartOptions(locale));
    // A 1s chart names its seconds on the time axis (TR-35).
    if (seconds) chart.applyOptions({ timeScale: { secondsVisible: true } });
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
      // The drawing layer leaves before the chart it is attached to.
      detachLayer.current?.();
      detachLayer.current = null;
      if (extendable) scale.unsubscribeVisibleLogicalRangeChange(onRange);
      write.current = null;
      updateForming.current = null;
      written.current = null;
      chartApi.current = null;
      priceSeries.current = null;
      referenceSeries.current = null;
      drawnLines.current = [];
      markersApi.current = null;
      chart.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `toggles` is read through `togglesKey`.
  }, [ready, togglesKey, places, theme, extendable, time, locale, seconds]);

  // D-159: the reference bars after the exchange's last one, apart from it.
  const lastOwn = series.forming?.openTime ?? series.candles.at(-1)?.openTime;
  useEffect(() => {
    const chart = chartApi.current;
    if (!chart) return;
    const after = lastOwn ? Date.parse(lastOwn) : Number.NEGATIVE_INFINITY;
    const bars = latestReference.current
      .filter((bar) => Date.parse(bar.openTime) > after)
      .map((bar) => ({
        time: time(bar),
        open: Number(bar.open),
        high: Number(bar.high),
        low: Number(bar.low),
        close: Number(bar.close),
      }));
    if (bars.length === 0) {
      referenceSeries.current?.setData([]);
      return;
    }
    if (!referenceSeries.current) {
      // Hollow bars in their own colour: plainly not the exchange's.
      const reference = token('--cp-purple');
      referenceSeries.current = chart.addSeries(CandlestickSeries, {
        upColor: 'transparent',
        downColor: reference,
        borderVisible: true,
        borderUpColor: reference,
        borderDownColor: reference,
        wickUpColor: reference,
        wickDownColor: reference,
        priceLineVisible: false,
        lastValueVisible: true,
      });
    }
    referenceSeries.current.setData(bars);
  }, [
    referenceKey,
    lastOwn,
    ready,
    togglesKey,
    places,
    theme,
    time,
    locale,
    extendable,
  ]);

  // The drawing layer goes on each chart built once the drawings are loaded.
  useEffect(() => {
    const chart = chartApi.current;
    const candles = priceSeries.current;
    if (!drawingsOn || !chart || !candles || !container.current) return;
    detachLayer.current = attach(chart, candles, container.current);
    return () => {
      detachLayer.current?.();
      detachLayer.current = null;
    };
  }, [
    drawingsOn,
    attach,
    ready,
    togglesKey,
    places,
    theme,
    extendable,
    time,
    locale,
  ]);

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
        latestLines.current.forEach((line, index) => {
          if (!line.drag) return;
          // The dragged line follows the handle; put back once dropped.
          const at = Number(
            dragging.current?.id === line.id
              ? dragging.current.price
              : line.price,
          );
          const drawn = drawnLines.current[index];
          if (drawn && drawn.options().price !== at)
            drawn.applyOptions({ price: at });
        });
        for (const line of latestLines.current) {
          if (!line.action && !line.drag) continue;
          const moving =
            dragging.current?.id === line.id ? dragging.current.price : null;
          const y = candles.priceToCoordinate(Number(moving ?? line.price));
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

  // Labels of the lines that yield are hidden while they would sit on
  // another label; checked each frame as the chips are, set only on change.
  useEffect(() => {
    if (!hasYielding) return;
    let frame = 0;
    let drawn: readonly IPriceLine[] | null = null;
    let shown = '';
    const place = () => {
      const candles = priceSeries.current;
      if (candles) {
        const all = latestLines.current;
        const { candles: closed, forming } = latest.current;
        const last = (forming ?? closed.at(-1))?.close;
        const lastY = last ? candles.priceToCoordinate(Number(last)) : null;
        const visible = labelsShown(
          all.map((line) => ({
            y: candles.priceToCoordinate(Number(line.price)),
            ...(line.yields ? { yields: true } : {}),
          })),
          lastY === null ? [] : [lastY],
        );
        const key = visible.join(',');
        if (drawn !== drawnLines.current || key !== shown) {
          drawn = drawnLines.current;
          shown = key;
          all.forEach((line, i) => {
            if (line.yields)
              drawnLines.current[i]?.applyOptions({
                axisLabelVisible: visible[i] ?? true,
                title: visible[i] ? line.label : '',
              });
          });
        }
      }
      frame = requestAnimationFrame(place);
    };
    frame = requestAnimationFrame(place);
    return () => cancelAnimationFrame(frame);
  }, [hasYielding]);

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
  const heightClass = height ?? HEIGHTS[panels];

  return (
    <section
      aria-label={c.itemsLabel}
      className="rounded-xl border border-line bg-surface p-3 sm:p-4"
    >
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <TimeframePicker
          label={c.timeframeLabel}
          moreLabel={c.moreTimeframes}
          value={timeframe}
          onChange={onTimeframeChange}
          options={
            timeframes ??
            (TIMEFRAMES as readonly ChartTimeframe[] as readonly T[])
          }
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
                'h-7 rounded-full border px-2.5 text-xs font-medium pointer-coarse:h-9',
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
                'h-7 rounded-full border px-2.5 text-xs font-medium pointer-coarse:h-9',
                item.pressed
                  ? 'border-primary-line bg-primary-soft text-primary'
                  : 'border-line text-muted hover:text-fg-2',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        {referenceLabel && (referenceBars?.length ?? 0) > 0 && (
          <span
            data-testid="chart-reference-label"
            className="rounded-full border border-(--cp-purple) px-2 text-xs font-medium text-(--cp-purple)"
          >
            {referenceLabel}
          </span>
        )}
        {drawingsOn && <ChartLayoutMenu layer={layer} symbol={symbol} />}
        {series.loadingOlder && (
          <span role="status" className="text-xs text-muted">
            {c.loadingOlder}
          </span>
        )}
        <span className="ml-auto inline-flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-xs text-muted">
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
          {expandTo && (
            <Link
              to={expandTo}
              aria-label={c.openInChart}
              title={c.openInChart}
              className="inline-flex size-7 items-center justify-center rounded-md border border-line text-muted hover:bg-raised hover:text-fg-2"
            >
              <Maximize2 size={14} aria-hidden="true" />
            </Link>
          )}
        </span>
      </div>
      {series.status === 'loading' ? (
        <Skeleton className={classNames('w-full', heightClass)} />
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
        <div className="flex gap-2">
          {drawingsOn && <DrawingToolbar layer={layer} symbol={symbol} />}
          <div className="min-w-0 flex-1">
            <div className="relative">
              <div
                ref={container}
                role="img"
                aria-label={formatCopy(c.chartLabel, {
                  symbol,
                  timeframe,
                  count: series.candles.length,
                })}
                className={classNames('w-full', heightClass)}
              />
              {(hasActions ? anchors : []).map((anchor) => {
                const line = lines.find((each) => each.id === anchor.id);
                const action = line?.action;
                const drag = line?.drag;
                const moving =
                  draggingPrice?.id === anchor.id ? draggingPrice.price : null;
                const drop = () => {
                  const next = dragging.current;
                  moveTo(null);
                  if (drag && line && next && next.price !== line.price)
                    drag.onDrop(next.price);
                };
                return line && (action || drag) ? (
                  <div
                    key={anchor.id}
                    style={{ top: anchor.y }}
                    className={classNames(
                      'absolute left-2 z-10 inline-flex -translate-y-1/2 items-center gap-1 rounded border bg-surface font-mono text-xs leading-none',
                      drag ? '' : 'pl-1.5',
                      moving ? 'ring-1 ring-primary' : '',
                      CHIP_TONES[line.tone],
                    )}
                  >
                    {drag ? (
                      <button
                        type="button"
                        aria-label={drag.label}
                        title={drag.label}
                        disabled={drag.disabled}
                        data-testid={'chart-line-drag-' + line.id}
                        className="inline-flex cursor-ns-resize touch-none items-center gap-0.5 py-1 pr-0.5 pl-1 disabled:cursor-not-allowed disabled:opacity-50"
                        onPointerDown={(event) => {
                          event.currentTarget.setPointerCapture?.(
                            event.pointerId,
                          );
                          pointer.current = {
                            id: line.id,
                            startY: event.clientY,
                            moved: false,
                          };
                        }}
                        onPointerMove={(event) => {
                          const held = pointer.current;
                          if (!held || held.id !== line.id) return;
                          if (
                            !held.moved &&
                            Math.abs(event.clientY - held.startY) < 3
                          )
                            return;
                          held.moved = true;
                          const price = priceAt(event.clientY);
                          if (price) moveTo({ id: line.id, price });
                        }}
                        onPointerUp={() => {
                          const held = pointer.current;
                          pointer.current = null;
                          if (held?.moved) drop();
                        }}
                        onPointerCancel={() => {
                          pointer.current = null;
                          moveTo(null);
                        }}
                        onKeyDown={(event) => {
                          if (
                            event.key === 'ArrowUp' ||
                            event.key === 'ArrowDown'
                          ) {
                            event.preventDefault();
                            const from = dragging.current?.price ?? line.price;
                            const next =
                              event.key === 'ArrowUp'
                                ? add(from, tick)
                                : subtract(from, tick);
                            if (Number(next) > 0)
                              moveTo({
                                id: line.id,
                                price: toStep(next, tick, 'half-up'),
                              });
                          } else if (
                            event.key === 'Enter' &&
                            dragging.current
                          ) {
                            event.preventDefault();
                            drop();
                          } else if (event.key === 'Escape') {
                            moveTo(null);
                          }
                        }}
                        onBlur={() => {
                          if (!pointer.current) moveTo(null);
                        }}
                      >
                        <GripVertical size={11} aria-hidden="true" />
                        <span>
                          {moving
                            ? formatCopy(c.dragTo, { price: moving })
                            : line.label}
                        </span>
                      </button>
                    ) : (
                      <span className="py-1">{line.label}</span>
                    )}
                    {action && (
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
                    )}
                  </div>
                ) : null;
              })}
              {drawingsOn && layer.selected && (
                <DrawingFloatingBar layer={layer} drawing={layer.selected} />
              )}
            </div>
            {series.candles.length < 200 && toggles.ema200 && (
              <p className="mt-2 text-xs text-muted-dim">{c.insufficient}</p>
            )}
          </div>
        </div>
      )}
      {layer.textDraft && (
        <DrawingTextDialog
          onSubmit={layer.submitText}
          onCancel={layer.cancelText}
        />
      )}
    </section>
  );
}
