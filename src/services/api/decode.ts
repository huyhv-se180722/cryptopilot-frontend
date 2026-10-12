/**
 * Small runtime checks shared by the response decoders: unknown input
 * becomes a typed value only after passing them. Decimals stay strings.
 */
export function record(value: unknown, name = 'body'): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new Error(name + ' must be an object');
  return value as Record<string, unknown>;
}
export function list(value: unknown, name: string): readonly unknown[] {
  if (!Array.isArray(value)) throw new Error(name + ' must be an array');
  return value;
}
export function text(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.length === 0)
    throw new Error(name + ' must be a non-empty string');
  return value;
}
export function nullableText(value: unknown, name: string): string | null {
  return value === null || value === undefined ? null : text(value, name);
}
const DECIMAL = /^-?\d+(\.\d+)?$/;
export function decimal(value: unknown, name: string): string {
  const raw = text(value, name);
  if (!DECIMAL.test(raw)) throw new Error(name + ' must be a decimal');
  return raw;
}
export function nullableDecimal(value: unknown, name: string): string | null {
  return value === null || value === undefined ? null : decimal(value, name);
}
export function integer(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value))
    throw new Error(name + ' must be an integer');
  return value;
}
export function instant(value: unknown, name: string): string {
  const raw = text(value, name);
  if (Number.isNaN(Date.parse(raw)))
    throw new Error(name + ' must be an instant');
  return raw;
}
export function nullableInstant(value: unknown, name: string): string | null {
  return value === null || value === undefined ? null : instant(value, name);
}
