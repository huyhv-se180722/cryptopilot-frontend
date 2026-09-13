import { Navigate, Outlet, useLocation } from 'react-router-dom';
import type { AccountRole } from '../../types/domain';
import { useAuth } from '../../hooks/use-auth';
import { canAccessRole } from '../../services/auth/access';
import { ErrorState, Loading } from '../../components/feedback/States';

export function ProtectedRoute({ roles }: { roles: readonly AccountRole[] }) {
  const auth = useAuth();
  const location = useLocation();
  if (auth.status === 'loading') return <Loading label="Restoring session…" />;
  if (auth.status === 'error')
    return (
      <ErrorState message={auth.message} onRetry={() => void auth.restore()} />
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
        title="Access denied"
        message="Your account does not have access to this area."
      />
    );
  return <Outlet />;
}
