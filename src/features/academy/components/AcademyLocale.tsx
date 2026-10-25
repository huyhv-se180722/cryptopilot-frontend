import type { PropsWithChildren } from 'react';
import { I18nProvider } from '../../../i18n/I18nProvider';

/**
 * The Academy reads in Vietnamese, as its lessons are written (T-114): its
 * labels come from the Vietnamese copy, with English for any key it lacks.
 * The rest of the app keeps its language (A-45).
 */
export function AcademyLocale({ children }: PropsWithChildren) {
  return <I18nProvider locale="vi">{children}</I18nProvider>;
}
