import { en, type Copy } from './locales/en';
import { vi, type PartialCopy } from './locales/vi';

export type Locale = 'en' | 'vi';
export const DEFAULT_LOCALE: Locale = 'en';

const overrides: Record<Locale, PartialCopy> = { en: {}, vi };

function merge<T>(base: T, override: unknown): T {
  if (typeof base === 'string') {
    return (
      typeof override === 'string' && override.trim() ? override : base
    ) as T;
  }
  if (typeof override !== 'object' || override === null) return base;
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(base as Record<string, unknown>)) {
    result[key] = merge(value, (override as Record<string, unknown>)[key]);
  }
  return result as T;
}

/** Locale copy with English fallback for every missing or blank key. */
export function resolveCopy(locale: Locale): Copy {
  return merge<Copy>(en, overrides[locale]);
}

/** Replaces `{name}` placeholders; unknown placeholders stay visible. */
export function formatCopy(
  template: string,
  args: Readonly<Record<string, string | number>>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in args ? String(args[name]) : match,
  );
}
