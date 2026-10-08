import { ErrorState } from '../../components/feedback/States';
import { useCopy } from '../../hooks/use-copy';

export function RouteError() {
  const copy = useCopy();
  return <ErrorState message={copy.errors.routeLoad} />;
}
