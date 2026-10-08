import { useContext } from 'react';
import { I18nContext } from '../i18n/i18n-context';

/** Typed interface copy for the active locale. */
export function useCopy() {
  return useContext(I18nContext).copy;
}

export { formatCopy } from '../i18n/copy';
