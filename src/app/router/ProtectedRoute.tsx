import { Navigate, Outlet, useLocation } from 'react-router-dom';
import type { AccountRole } from '../../types/domain';
import { useAuth } from '../../hooks/use-auth';
import { canAccessRole } from '../../services/auth/access';
import { ErrorState, Loading } from '../../components/feedback/States';
import { useCopy } from '../../hooks/use-copy';

export function ProtectedRoute({ roles }: { roles: readonly AccountRole[] }) {
  const auth = useAuth();
  const location = useLocation();
  const copy = useCopy();
  if (auth.status === 'loading')
    return <Loading label={copy.access.restoring} />;
  if (auth.status === 'error')
    return (
      <ErrorState
        message={copy.access.unavailable}
        onRetry={() => void auth.restore()}
      />
    );
  if (!auth.session)
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  if (!canAccessRole(auth.session, roles))
    return (
      <ErrorState
        title={copy.access.deniedTitle}
        message={copy.access.deniedBody}
      />
    );
  return <Outlet />;
}
