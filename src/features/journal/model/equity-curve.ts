import type { Decimal, EquityPoint } from '../../../types/domain';
import { addDays } from '../../../utils/business-day';
import { compare, subtract } from '../../../utils/decimal-math';

export interface CurvePoint {
  day: string;
  cumulative: Decimal;
  /** At or below 0: how far under its highest point so far. */
  drawdown: Decimal;
}

/**
 * The API sends only days with an exit: the curve gets its 0 at `from`, or
 * the day before the first exit when that day is `from` itself or there is
 * no `from`, as the chart needs one point per day. The peak starts at that
 * 0, like the backend's maximum drawdown.
 */
export function equityCurve(
  points: readonly EquityPoint[],
  from: string | null | undefined,
): readonly CurvePoint[] {
  const first = points[0];
  if (!first) return [];
  const start = from && from < first.day ? from : addDays(first.day, -1);
  let peak = '0';
  return [
    { day: start, cumulative: '0', drawdown: '0' },
    ...points.map((point) => {
      if (compare(point.cumulativeNetPnl, peak) > 0)
        peak = point.cumulativeNetPnl;
      return {
        day: point.day,
        cumulative: point.cumulativeNetPnl,
        drawdown: subtract(point.cumulativeNetPnl, peak),
      };
    }),
  ];
}
