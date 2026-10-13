import type { SeriesMarker, Time, UTCTimestamp } from 'lightweight-charts';
import type { Candle, ISODateTime } from '../../../types/domain';

/** Which design token draws a price line or a marker, so both themes follow. */
export const TONE_TOKENS = {
  positive: '--cp-positive',
  negative: '--cp-negative',
  neutral: '--cp-muted',
  primary: '--cp-primary',
  warning: '--cp-warning',
} as const;
export type ChartTone = keyof typeof TONE_TOKENS;

/**
 * An arrow on the candle that contains `time`, e.g. a fill: up below the
 * bar, down above it. A time before the loaded candles is not drawn.
 */
export interface ChartMarker {
  id: string;
  time: ISODateTime;
  direction: 'up' | 'down';
  tone: ChartTone;
  text?: string;
}

/** A candle's time on the chart's axis (UTC seconds). */
export const barTime = (candle: Candle) =>
  (Date.parse(candle.openTime) / 1000) as UTCTimestamp;

/**
 * The markers placed on the bar whose period contains their time (the
 * last bar opened at or before it), sorted by time as the chart needs.
 */
export function placeMarkers(
  markers: readonly ChartMarker[],
  bars: readonly Candle[],
  color: (tone: ChartTone) => string,
): SeriesMarker<Time>[] {
  const opens = bars.map((bar) => Date.parse(bar.openTime));
  return markers
    .flatMap((marker) => {
      const at = Date.parse(marker.time);
      let low = 0;
      let high = opens.length - 1;
      let found = -1;
      while (low <= high) {
        const mid = (low + high) >> 1;
        if ((opens[mid] ?? Infinity) <= at) {
          found = mid;
          low = mid + 1;
        } else high = mid - 1;
      }
      const bar = bars[found];
      if (!bar) return [];
      const up = marker.direction === 'up';
      const placed: SeriesMarker<UTCTimestamp> = {
        id: marker.id,
        time: barTime(bar),
        position: up ? 'belowBar' : 'aboveBar',
        shape: up ? 'arrowUp' : 'arrowDown',
        color: color(marker.tone),
        ...(marker.text ? { text: marker.text } : {}),
      };
      return [placed];
    })
    .sort((a, b) => a.time - b.time);
}
