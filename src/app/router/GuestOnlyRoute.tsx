import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Loading } from '../../components/feedback/States';
import { useAuth } from '../../hooks/use-auth';
import { useCopy } from '../../hooks/use-copy';
import { decideAccess } from './access-decision';

/** SCR-02…06 are for guests only (SRS 3.1.3). */
export function GuestOnlyRoute() {
  const auth = useAuth();
  const location = useLocation();
  const state: unknown = location.state;
  const from =
    typeof state === 'object' &&
    state !== null &&
    'from' in state &&
    typeof state.from === 'string' &&
    state.from.startsWith('/') &&
    !state.from.startsWith('//')
      ? state.from
      : undefined;
  const copy = useCopy();
  const decision = decideAccess(auth, { kind: 'guest-only' });
  if (decision.type === 'loading')
    return <Loading label={copy.access.restoring} />;
  if (decision.type === 'home')
    return <Navigate to={from ?? decision.path} replace />;
  return <Outlet />;
}
