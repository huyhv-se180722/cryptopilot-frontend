import type { PropsWithChildren } from 'react';
import { I18nProvider } from '../../../i18n/I18nProvider';

/**
 * The news screens read in Vietnamese, as the articles the AI writes do
 * (D-123, D-125): their labels come from the Vietnamese copy, with English
 * for any key it lacks. The rest of the app keeps its language (A-45).
 */
export function NewsLocale({ children }: PropsWithChildren) {
  return <I18nProvider locale="vi">{children}</I18nProvider>;
}
