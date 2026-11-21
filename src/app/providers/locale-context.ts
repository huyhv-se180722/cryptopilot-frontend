import { createContext } from 'react';
import type { Locale } from '../../i18n/copy';

export interface LocaleValue {
  /** The language the visitor chose for the whole app. */
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

export const LocaleContext = createContext<LocaleValue | null>(null);
