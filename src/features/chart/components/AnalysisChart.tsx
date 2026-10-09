import { useEffect, useRef, useState } from 'react';
import {
  CandlestickSeries,
  ColorType,
  HistogramSeries,
  LineSeries,
  createChart,
  type CandlestickData,
  type IChartApi,
  type ISeriesApi,
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

const TIMEFRAMES: readonly CandleTimeframe[] = ['15m', '1h', '4h', '1d'];
/** Price pane 320px plus 110px per shown panel. */
const HEIGHTS = ['h-[320px]', 'h-[430px]', 'h-[540px]', 'h-[650px]'] as const;

function token(name: string) {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}

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

const time = (candle: Candle) =>
  (Date.parse(candle.openTime) / 1000) as UTCTimestamp;

function line(candles: readonly Candle[], values: Series) {
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

function build(
  chart: IChartApi,
  toggles: ChartToggles,
  places: number,
  levels: PriceLevels | undefined,
  labels: { support: string; resistance: string },
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
  // BR-14: nearest support and resistance as horizontal lines.
  for (const [price, colour, title] of [
    [levels?.support ?? null, up, labels.support],
    [levels?.resistance ?? null, down, labels.resistance],
  ] as const)
    if (price !== null)
      candles.createPriceLine({
        price: Number(price),
        color: colour,
        lineWidth: 1,
        lineStyle: 1,
        axisLabelVisible: true,
        title,
      });
  writers.push(({ candles: closed, forming }) => {
    const bars: CandlestickData<UTCTimestamp>[] = closed.map((candle) => ({
      time: time(candle),
      open: Number(candle.open),
      high: Number(candle.high),
      low: Number(candle.low),
      close: Number(candle.close),
    }));
    if (forming) {
      const rising = Number(forming.close) >= Number(forming.open);
      // Provisional (SRS 3.3.2): the forming candle is drawn faded.
      const colour = rising ? upDim : downDim;
      bars.push({
        time: time(forming),
        open: Number(forming.open),
        high: Number(forming.high),
        low: Number(forming.low),
        close: Number(forming.close),
        color: colour,
        wickColor: colour,
      });
    }
    candles.setData(bars);
  });

  const overlay = (
    name: 'sma20' | 'ema20' | 'ema50' | 'ema200',
    pick: (indicators: ChartIndicators) => Series,
  ) => {
    const series = chart.addSeries(LineSeries, lineOptions(name));
    writers.push(({ candles: closed, indicators }) =>
      series.setData(indicators ? line(closed, pick(indicators)) : []),
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
          indicators ? line(closed, indicators.bollinger[band]) : [],
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
      series.setData(indicators ? line(closed, values(indicators)) : []),
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

  return (data: Data) => writers.forEach((write) => write(data));
}

function chartOptions() {
  return {
    autoSize: true,
    layout: {
      background: { type: ColorType.Solid, color: 'transparent' },
      textColor: token('--cp-muted'),
      fontFamily: 'JetBrains Mono, ui-monospace, monospace',
      fontSize: 11,
      attributionLogo: false,
      panes: { separatorColor: token('--cp-border') },
    },
    grid: {
      vertLines: { color: token('--cp-border') },
      horzLines: { color: token('--cp-border') },
    },
    rightPriceScale: { borderColor: token('--cp-border') },
    timeScale: {
      borderColor: token('--cp-border'),
      timeVisible: true,
      secondsVisible: false,
    },
  };
}

/**
 * SCR-10 chart (SRS 3.3.2, BR-12): timeframe 15m / 1h / 4h / 1d (default
 * 1h, BR-08), the latest 500 closed candles and the forming one drawn
 * faded as provisional; overlays SMA 20, EMA 20 / 50 / 200 and Bollinger;
 * panels Volume with its SMA 20, RSI 14 and MACD. Each item can be hidden,
 * and the choice is remembered on the device.
 */
export function AnalysisChart({
  market,
  symbol,
  tickSize,
  timeframe,
  onTimeframeChange,
  levels,
}: {
  market: MarketType;
  symbol: string;
  tickSize: string | null;
  timeframe: CandleTimeframe;
  onTimeframeChange: (timeframe: CandleTimeframe) => void;
  levels?: PriceLevels;
}) {
  const copy = useCopy();
  const c = copy.chart;
  const { toggles, toggle } = useChartPreferences();
  const series = useChartSeries(market, symbol, timeframe);
  const container = useRef<HTMLDivElement>(null);
  const write = useRef<((data: Data) => void) | null>(null);
  const latest = useRef<Data>(series);
  const ready = series.status === 'ready';
  const togglesKey = CHART_ITEMS.map((item) => (toggles[item] ? 1 : 0)).join(
    '',
  );
  const places = decimalPlaces(tickSize);
  const [theme, setTheme] = useState(0);

  useEffect(() => {
    const observer = new MutationObserver(() => setTheme((value) => value + 1));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => observer.disconnect();
  }, []);

  // Declared before the rebuild so a rebuild writes the newest data.
  useEffect(() => {
    latest.current = series;
  });

  // Rebuilt when the shown items, the precision or the theme change.
  useEffect(() => {
    if (!ready || !container.current) return;
    const chart = createChart(container.current, chartOptions());
    write.current = build(chart, toggles, places, levels, {
      support: copy.analysis.support,
      resistance: copy.analysis.resistance,
    });
    write.current(latest.current);
    chart.timeScale().fitContent();
    return () => {
      write.current = null;
      chart.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `toggles` is read through `togglesKey`.
  }, [ready, togglesKey, places, theme, levels?.support, levels?.resistance]);

  useEffect(() => {
    write.current?.({
      candles: series.candles,
      forming: series.forming,
      indicators: series.indicators,
    });
  }, [series.candles, series.forming, series.indicators]);

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
        </div>
        {series.forming && (
          <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] text-muted">
            <span
              aria-hidden="true"
              className="h-3 w-1.5 rounded-sm bg-positive-line"
            />
            {c.forming}
          </span>
        )}
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
          {series.candles.length < 200 && toggles.ema200 && (
            <p className="mt-2 text-[11px] text-muted-dim">{c.insufficient}</p>
          )}
        </>
      )}
    </section>
  );
}
