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
