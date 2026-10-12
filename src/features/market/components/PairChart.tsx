import { useEffect, useRef } from 'react';
import {
  CandlestickSeries,
  ColorType,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts';
import type { Candle } from '../../../types/domain';
import { decimalPlaces } from '../../../utils/decimal-format';

/** Reads a design token so the chart follows the light and dark themes. */
function token(name: string) {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}

function themeOptions() {
  return {
    layout: {
      background: { type: ColorType.Solid, color: 'transparent' },
      textColor: token('--cp-muted'),
      fontFamily: 'JetBrains Mono, ui-monospace, monospace',
      fontSize: 11,
      attributionLogo: false,
    },
    grid: {
      vertLines: { color: token('--cp-border') },
      horzLines: { color: token('--cp-border') },
    },
    rightPriceScale: { borderColor: token('--cp-border') },
    timeScale: { borderColor: token('--cp-border') },
  };
}

function seriesColors() {
  const up = token('--cp-positive');
  const down = token('--cp-negative');
  return {
    upColor: up,
    downColor: down,
    wickUpColor: up,
    wickDownColor: down,
    borderVisible: false,
  };
}

/**
 * SCR-01 basic chart: closed daily candles, no indicators (SRS 3.3.1).
 * Prices are decimal strings everywhere else; they become numbers only
 * here, for drawing, with the pair's tick precision on the scale.
 */
export function PairChart({
  candles,
  tickSize,
  label,
}: {
  candles: readonly Candle[];
  tickSize: string | null;
  label: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const series = useRef<ISeriesApi<'Candlestick'> | null>(null);

  useEffect(() => {
    if (!container.current) return;
    const created = createChart(container.current, {
      autoSize: true,
      ...themeOptions(),
      handleScroll: false,
      handleScale: false,
    });
    chart.current = created;
    series.current = created.addSeries(CandlestickSeries, seriesColors());
    return () => {
      created.remove();
      chart.current = null;
      series.current = null;
    };
  }, []);

  // The theme provider writes `data-theme` on <html>; repaint from tokens.
  useEffect(() => {
    const observer = new MutationObserver(() => {
      chart.current?.applyOptions(themeOptions());
      series.current?.applyOptions(seriesColors());
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const places = decimalPlaces(tickSize);
    series.current?.applyOptions({
      priceFormat: {
        type: 'price',
        precision: places,
        minMove: places === 0 ? 1 : Number('1e-' + places),
      },
    });
    series.current?.setData(
      candles.map((candle) => ({
        time: (Date.parse(candle.openTime) / 1000) as UTCTimestamp,
        open: Number(candle.open),
        high: Number(candle.high),
        low: Number(candle.low),
        close: Number(candle.close),
      })),
    );
    chart.current?.timeScale().fitContent();
  }, [candles, tickSize]);

  return (
    <div
      ref={container}
      role="img"
      aria-label={label}
      className="h-64 w-full sm:h-72"
    />
  );
}
