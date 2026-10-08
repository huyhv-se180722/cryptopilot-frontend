import { useEffect } from 'react';
import { useCopy } from '../../hooks/use-copy';
import { useRouteHandle } from './use-route-handle';

/** Keeps <title> in sync with the matched screen. */
export function DocumentTitle() {
  const handle = useRouteHandle();
  const copy = useCopy();
  useEffect(() => {
    document.title = handle
      ? copy.screens[handle.titleKey] + ' · ' + copy.product.name
      : copy.product.name;
  }, [handle, copy]);
  return null;
}
