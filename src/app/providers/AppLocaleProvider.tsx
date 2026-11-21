import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import type { Locale } from '../../i18n/copy';
import { I18nProvider } from '../../i18n/I18nProvider';
import { readLocale, writeLocale } from '../../i18n/locale-preference';
import { LocaleContext } from './locale-context';

function safeStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

/**
 * Owns the Vietnamese / English choice, Vietnamese until one is made, and
 * gives it to the interface copy and to <html lang>. Screens that always
 * read in Vietnamese (news, Academy, the AI assistant) keep their own
 * provider inside this one.
 */
export function AppLocaleProvider({ children }: PropsWithChildren) {
  const [locale, setLocaleState] = useState(() => readLocale(safeStorage()));

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    writeLocale(safeStorage(), next);
    setLocaleState(next);
  }, []);

  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);
  return (
    <LocaleContext.Provider value={value}>
      <I18nProvider locale={locale}>{children}</I18nProvider>
    </LocaleContext.Provider>
  );
}
