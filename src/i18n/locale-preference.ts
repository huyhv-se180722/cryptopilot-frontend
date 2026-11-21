import type { Locale } from './copy';

/**
 * The interface language a visitor chose, kept on the device like the
 * theme (ADR-013): a display preference only, never business data.
 */
export const LOCALE_STORAGE_KEY = 'cp-locale';

/** What the app shows before a choice is made. */
export const APP_DEFAULT_LOCALE: Locale = 'vi';

export function parseLocale(value: unknown): Locale {
  return value === 'en' || value === 'vi' ? value : APP_DEFAULT_LOCALE;
}

export function readLocale(
  storage: Pick<Storage, 'getItem'> | undefined,
): Locale {
  try {
    return parseLocale(storage?.getItem(LOCALE_STORAGE_KEY));
  } catch {
    return APP_DEFAULT_LOCALE;
  }
}

export function writeLocale(
  storage: Pick<Storage, 'setItem'> | undefined,
  locale: Locale,
): void {
  try {
    storage?.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Private mode or a full quota: the choice lasts for this visit only.
  }
}
