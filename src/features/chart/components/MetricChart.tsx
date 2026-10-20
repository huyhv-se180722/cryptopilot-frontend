import { useEffect, useRef } from 'react';
import { LineSeries, createChart } from 'lightweight-charts';
import { useCopy, useLocale } from '../../../hooks/use-copy';
import { formatCopy } from '../../../i18n/copy';
import type { Decimal, ISODateTime } from '../../../types/domain';
import { chartOptions, token, useThemeVersion } from './chart-theme';
import { chartOffsetSeconds, chartTime, zoneLabel } from './chart-time';

export interface MetricLine {
  id: string;
  /** Design token of the line colour. */
  colorToken: string;
  /** Left or right price scale, so two units can share the chart. */
  scale: 'left' | 'right';
  /**
   * Axis labels: compact (K / M / B) for amounts, 4 decimals for ratios,
   * 2 decimals for a worth in USDT.
   */
  format: 'amount' | 'ratio' | 'usdt';
  points: readonly { time: ISODateTime; value: Decimal }[];
}

/**
 * A time series line chart in the theme of the analysis chart (SCR-11
 * open interest and long/short ratio). Drawing only: the values become
 * numbers for the chart library, the panels show the decimal strings.
 * Points are drawn where they exist; a gap is never filled. Times are in
 * the Trader's local time, as on the candle chart (chart-time.ts).
 */
export function MetricChart({
  label,
  lines,
  daily = false,
}: {
  label: string;
  lines: readonly MetricLine[];
  /** Points at the start of UTC days: drawn in UTC, as daily candles. */
  daily?: boolean;
}) {
  const copy = useCopy();
  const locale = useLocale();
  const container = useRef<HTMLDivElement>(null);
  const theme = useThemeVersion();
  const offset = chartOffsetSeconds(daily ? '1d' : 'intraday');

  useEffect(() => {
    if (!container.current) return;
    const left = lines.some((line) => line.scale === 'left');
    const options = chartOptions(locale);
    const chart = createChart(container.current, {
      ...options,
      leftPriceScale: {
        visible: left,
        borderColor: options.rightPriceScale.borderColor,
      },
    });
    for (const line of lines) {
      const series = chart.addSeries(LineSeries, {
        color: token(line.colorToken),
        lineWidth: 2,
        priceScaleId: line.scale,
        priceLineVisible: false,
        priceFormat:
          line.format === 'amount'
            ? { type: 'volume' as const }
            : line.format === 'usdt'
              ? { type: 'price' as const, precision: 2, minMove: 0.01 }
              : { type: 'price' as const, precision: 4, minMove: 0.0001 },
      });
      series.setData(
        line.points.map((point) => ({
          time: chartTime(point.time, offset),
          value: Number(point.value),
        })),
      );
    }
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [lines, theme, offset, locale]);

  return (
    <>
      <div
        ref={container}
        role="img"
        aria-label={label}
        className="h-[220px] w-full"
      />
      <p className="mt-1 text-right text-[11px] text-muted-dim">
        {formatCopy(copy.chart.timeZone, { zone: zoneLabel(offset) })}
      </p>
    </>
  );
}
