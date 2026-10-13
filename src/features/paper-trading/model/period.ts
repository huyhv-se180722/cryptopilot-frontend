/** History periods of the exchange's filter bars (B Order History). */
export type Period = '7' | '30' | '90' | 'all';

const DAY_MS = 86_400_000;

/** The start of a period as ISO 8601 UTC, or undefined for every time. */
export function periodStart(
  period: Period,
  now = Date.now(),
): string | undefined {
  return period === 'all'
    ? undefined
    : new Date(now - Number(period) * DAY_MS).toISOString();
}
