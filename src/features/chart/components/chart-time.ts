import type { UTCTimestamp } from 'lightweight-charts';
import type { CandleTimeframe, ISODateTime } from '../../../types/domain';

/**
 * The chart library draws every time as UTC and has no time zones, so a
 * chart in the Trader's local time is fed times moved by the local offset
 * (the library's own advice). One fixed offset serves the whole chart, as
 * an exchange's "UTC+7" setting does: an offset that followed daylight
 * saving would give two bars the same time when the clock goes back, and
 * the library refuses times that do not rise.
 *
 * Daily candles stay in UTC: a Binance day runs from 00:00 UTC, so moving
 * them would only move the date labels away from the day they hold.
 */
export function chartOffsetSeconds(
  timeframe: CandleTimeframe | 'intraday',
  now: Date = new Date(),
): number {
  return timeframe === '1d' ? 0 : -now.getTimezoneOffset() * 60;
}

/** An instant as a time on the chart's axis, `offset` seconds from UTC. */
export function chartTime(time: ISODateTime, offset: number): UTCTimestamp {
  return (Date.parse(time) / 1000 + offset) as UTCTimestamp;
}

/** "UTC", "UTC+7", "UTC+5:30", "UTC-3:30": the zone the axis shows. */
export function zoneLabel(offset: number): string {
  if (offset === 0) return 'UTC';
  const minutes = Math.abs(offset) / 60;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `UTC${offset > 0 ? '+' : '-'}${hours}${rest ? ':' + String(rest).padStart(2, '0') : ''}`;
}
