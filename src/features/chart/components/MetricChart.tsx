import { useEffect, useRef } from 'react';
import { LineSeries, createChart, type UTCTimestamp } from 'lightweight-charts';
import type { Decimal, ISODateTime } from '../../../types/domain';
import { chartOptions, token, useThemeVersion } from './chart-theme';

export interface MetricLine {
  id: string;
  /** Design token of the line colour. */
  colorToken: string;
  /** Left or right price scale, so two units can share the chart. */
  scale: 'left' | 'right';
  /** Axis labels: compact (K / M / B) for amounts, 4 decimals for ratios. */
  format: 'amount' | 'ratio';
  points: readonly { time: ISODateTime; value: Decimal }[];
}

/**
 * A time series line chart in the theme of the analysis chart (SCR-11
 * open interest and long/short ratio). Drawing only: the values become
 * numbers for the chart library, the panels show the decimal strings.
 * Points are drawn where they exist; a gap is never filled.
 */
export function MetricChart({
  label,
  lines,
}: {
  label: string;
  lines: readonly MetricLine[];
}) {
  const container = useRef<HTMLDivElement>(null);
  const theme = useThemeVersion();

  useEffect(() => {
    if (!container.current) return;
    const left = lines.some((line) => line.scale === 'left');
    const options = chartOptions();
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
            : { type: 'price' as const, precision: 4, minMove: 0.0001 },
      });
      series.setData(
        line.points.map((point) => ({
          time: (Date.parse(point.time) / 1000) as UTCTimestamp,
          value: Number(point.value),
        })),
      );
    }
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [lines, theme]);

  return (
    <div
      ref={container}
      role="img"
      aria-label={label}
      className="h-[220px] w-full"
    />
  );
}
