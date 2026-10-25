import { useEffect, useRef } from 'react';
import {
  AreaSeries,
  ColorType,
  LineStyle,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts';
import { useLocale } from '../../../hooks/use-copy';
import type { Candle } from '../../../types/domain';
import { decimalPlaces } from '../../../utils/decimal-format';

/** Reads a design token so the chart follows the light and dark themes. */
function token(name: string) {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}

/** A `#rrggbb` token with an alpha, for the area under the line. */
function withAlpha(color: string, alpha: number) {
  const hex = /^#([0-9a-f]{6})$/i.exec(color);
  if (!hex) return 'transparent';
  const n = parseInt(hex[1]!, 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

function themeOptions() {
  return {
    layout: {
      background: { type: ColorType.Solid, color: 'transparent' },
      textColor: token('--cp-muted'),
      fontFamily: 'JetBrains Mono, ui-monospace, monospace',
      fontSize: 10,
      // The licence's attribution and link are in the shell footer.
      attributionLogo: false,
    },
    grid: {
      vertLines: { visible: false },
      horzLines: { color: token('--cp-border') },
    },
    rightPriceScale: { borderVisible: false },
    timeScale: { borderVisible: false },
  };
}

function areaColors(rising: boolean) {
  const line = token(rising ? '--cp-positive' : '--cp-negative');
  return {
    lineColor: line,
    topColor: withAlpha(line, 0.22),
    bottomColor: withAlpha(line, 0.02),
  };
}

/**
 * The market overview's chart, in the style of a news site's market
 * widget: the closes of a range as a line over a tinted area, green when
 * the range ends above where it began and red otherwise, with the first
 * close as a dashed reference line. Prices become numbers only here, for
 * drawing, at the pair's tick precision.
 */
export function OverviewChart({
  candles,
  tickSize,
  intraday,
  label,
}: {
  candles: readonly Candle[];
  tickSize: string | null;
  /** Times on the axis for ranges within a few days, dates otherwise. */
  intraday: boolean;
  label: string;
}) {
  const locale = useLocale();
  const container = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const series = useRef<ISeriesApi<'Area'> | null>(null);
  const first = candles[0];
  const last = candles.at(-1);
  const rising = !first || !last || Number(last.close) >= Number(first.close);

  useEffect(() => {
    if (!container.current) return;
    const created = createChart(container.current, {
      autoSize: true,
      ...themeOptions(),
      localization: { locale },
      handleScroll: false,
      handleScale: false,
      crosshair: { horzLine: { visible: false } },
    });
    chart.current = created;
    series.current = created.addSeries(AreaSeries, {
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
    });
    return () => {
      created.remove();
      chart.current = null;
      series.current = null;
    };
  }, [locale]);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      chart.current?.applyOptions(themeOptions());
      series.current?.applyOptions(areaColors(rising));
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => observer.disconnect();
  }, [rising]);

  useEffect(() => {
    const s = series.current;
    if (!s) return;
    const places = decimalPlaces(tickSize);
    s.applyOptions({
      ...areaColors(rising),
      priceFormat: {
        type: 'price',
        precision: places,
        minMove: places === 0 ? 1 : Number('1e-' + places),
      },
    });
    chart.current?.applyOptions({
      timeScale: { timeVisible: intraday, secondsVisible: false },
    });
    s.setData(
      candles.map((candle) => ({
        time: (Date.parse(candle.openTime) / 1000) as UTCTimestamp,
        value: Number(candle.close),
      })),
    );
    for (const line of s.priceLines()) s.removePriceLine(line);
    if (first)
      s.createPriceLine({
        price: Number(first.close),
        color: token('--cp-muted'),
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: false,
      });
    chart.current?.timeScale().fitContent();
  }, [candles, tickSize, intraday, rising, first, locale]);

  return (
    <div
      ref={container}
      role="img"
      aria-label={label}
      className="h-44 w-full"
    />
  );
}
