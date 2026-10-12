/** An instant as "YYYY-MM-DD HH:mm UTC", the same on every device. */
export function formatInstantUtc(value: string): string {
  const iso = new Date(value).toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}
