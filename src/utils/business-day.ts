const DAY_MS = 86_400_000;
const OFFSET_MS = 7 * 3_600_000;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Today as `yyyy-MM-dd` in UTC+7, the day the backend counts in (D-138). */
export function businessDay(now: number = Date.now()): string {
  return new Date(now + OFFSET_MS).toISOString().slice(0, 10);
}

/** The day `days` after `day`; calendar arithmetic, no time zone involved. */
export function addDays(day: string, days: number): string {
  return new Date(Date.parse(day + 'T00:00:00Z') + days * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

export function isDay(value: string): boolean {
  if (!DAY.test(value)) return false;
  const time = Date.parse(value + 'T00:00:00Z');
  return (
    !Number.isNaN(time) && new Date(time).toISOString().slice(0, 10) === value
  );
}
