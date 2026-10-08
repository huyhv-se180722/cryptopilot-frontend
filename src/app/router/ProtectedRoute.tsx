import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import type { AccountRole } from '../../types/domain';
import { useAuth } from '../../hooks/use-auth';
import { useCopy } from '../../hooks/use-copy';
import { ErrorState, Loading } from '../../components/feedback/States';
import { buttonClassName } from '../../components/ui/button-styles';
import { AccountBlockedScreen } from './AccountBlockedScreen';
import { decideAccess } from './access-decision';

export function ProtectedRoute({ roles }: { roles: readonly AccountRole[] }) {
  const auth = useAuth();
  const location = useLocation();
  const copy = useCopy();
  const decision = decideAccess(auth, { kind: 'roles', roles });
  switch (decision.type) {
    case 'loading':
      return <Loading label={copy.access.restoring} />;
    case 'unavailable':
      return (
        <ErrorState
          message={copy.access.unavailable}
          onRetry={() => void auth.restore()}
        />
      );
    case 'login':
      return (
        <Navigate
          to="/login"
          replace
          state={{ from: location.pathname + location.search }}
        />
      );
    case 'blocked':
      return <AccountBlockedScreen status={decision.status} />;
    case 'denied':
      return (
        <div className="flex flex-col items-center">
          <ErrorState
            title={copy.access.deniedTitle}
            message={copy.access.deniedBody}
          />
          <Link to={decision.home} className={buttonClassName('secondary')}>
            {copy.common.returnHome}
          </Link>
        </div>
      );
    case 'home':
    case 'allow':
      return <Outlet />;
  }
}
