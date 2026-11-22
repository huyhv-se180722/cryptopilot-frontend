import type { Decimal } from '../../../types/domain';

export interface DepthRow {
  price: Decimal;
  cumulative: Decimal;
}

export const DEPTH_W = 300;
export const DEPTH_H = 160;
const W = DEPTH_W;
const H = DEPTH_H;

/**
 * The points of one side's step line, from the best price outwards, in the
 * drawing's units: x along the price range, y down from the top.
 */
export function depthPath(
  rows: readonly DepthRow[],
  low: number,
  high: number,
  max: number,
): string {
  if (rows.length === 0 || high <= low || max <= 0) return '';
  const x = (price: number) => ((price - low) / (high - low)) * W;
  const y = (total: number) => H - (total / max) * H;
  const first = rows[0]!;
  const points = [`M${x(Number(first.price)).toFixed(2)},${H}`];
  let previous = 0;
  for (const row of rows) {
    const px = x(Number(row.price)).toFixed(2);
    points.push(`L${px},${y(previous).toFixed(2)}`);
    previous = Number(row.cumulative);
    points.push(`L${px},${y(previous).toFixed(2)}`);
  }
  const edge = x(Number(rows[rows.length - 1]!.price)).toFixed(2);
  points.push(`L${edge},${H}`, 'Z');
  return points.join(' ');
}
