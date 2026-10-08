import { createContext } from 'react';
import type { Copy } from './locales/en';
import { DEFAULT_LOCALE, resolveCopy, type Locale } from './copy';

export interface I18nValue {
  locale: Locale;
  copy: Copy;
}

export const I18nContext = createContext<I18nValue>({
  locale: DEFAULT_LOCALE,
  copy: resolveCopy(DEFAULT_LOCALE),
});
