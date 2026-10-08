import { useMatches } from 'react-router-dom';
import { isRouteHandle, type RouteHandle } from './route-definitions';

/** Metadata of the deepest matched route that declares a screen. */
export function useRouteHandle(): RouteHandle | undefined {
  const matches = useMatches();
  for (let index = matches.length - 1; index >= 0; index--) {
    const handle = matches[index]?.handle;
    if (isRouteHandle(handle)) return handle;
  }
  return undefined;
}
