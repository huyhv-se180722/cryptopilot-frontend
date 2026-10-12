/** Time left until `until` as HH:MM:SS (never negative); null without a time. */
export function formatCountdown(
  until: string | null,
  now: number,
): string | null {
  if (!until) return null;
  const seconds = Math.max(0, Math.floor((Date.parse(until) - now) / 1000));
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor(seconds / 60) % 60)}:${pad(seconds % 60)}`;
}
