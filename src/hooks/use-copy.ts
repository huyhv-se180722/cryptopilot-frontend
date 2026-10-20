import { useContext } from 'react';
import { I18nContext } from '../i18n/i18n-context';

/** Typed interface copy for the active locale. */
export function useCopy() {
  return useContext(I18nContext).copy;
}

/**
 * The active locale ('en' or 'vi', valid language tags). Dates and charts
 * format with it, so they read in the interface's language (A-45) and
 * never in the browser's.
 */
export function useLocale() {
  return useContext(I18nContext).locale;
}

export { formatCopy } from '../i18n/copy';
