import { RoutePlaceholder } from '../components/feedback/RoutePlaceholder';
import { useRouteHandle } from '../app/router/use-route-handle';
import { useCopy } from '../hooks/use-copy';

/** Reserved route until its feature branch delivers the screen. */
export function PlaceholderPage() {
  const handle = useRouteHandle();
  const copy = useCopy();
  if (!handle) return null;
  return (
    <RoutePlaceholder
      title={copy.screens[handle.titleKey]}
      screen={handle.screen}
    />
  );
}
