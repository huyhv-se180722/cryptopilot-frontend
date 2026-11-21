import { useContext } from 'react';
import { LocaleContext } from '../app/providers/locale-context';

/** The app's language choice; null outside the app shell (tests, stories). */
export function useLocalePreference() {
  return useContext(LocaleContext);
}
