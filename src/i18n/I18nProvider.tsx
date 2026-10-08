import { useMemo, type PropsWithChildren } from 'react';
import { DEFAULT_LOCALE, resolveCopy, type Locale } from './copy';
import { I18nContext } from './i18n-context';

export function I18nProvider({
  locale = DEFAULT_LOCALE,
  children,
}: PropsWithChildren<{ locale?: Locale }>) {
  const value = useMemo(
    () => ({ locale, copy: resolveCopy(locale) }),
    [locale],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
