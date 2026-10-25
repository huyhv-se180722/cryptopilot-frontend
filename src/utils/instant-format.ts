/** An instant in the device's time zone, "YYYY-MM-DD HH:mm" (the UTC form goes in a tooltip). */
export function formatInstantLocal(value: string): string {
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** An instant as "YYYY-MM-DD HH:mm UTC", the same on every device. */
export function formatInstantUtc(value: string): string {
  const iso = new Date(value).toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}

/** An instant as a `datetime-local` input value ("YYYY-MM-DDTHH:mm", device time zone). */
export function toLocalInput(value: string): string {
  return formatInstantLocal(value).replace(' ', 'T');
}

const UTC7_MS = 7 * 3_600_000;
/**
 * An instant in UTC+7 as "dd/MM/yyyy HH:mm" (CR-01), the same on every
 * device whatever its time zone.
 */
export function formatInstantUtc7(value: string): string {
  const iso = new Date(Date.parse(value) + UTC7_MS).toISOString();
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)} ${iso.slice(11, 16)}`;
}
