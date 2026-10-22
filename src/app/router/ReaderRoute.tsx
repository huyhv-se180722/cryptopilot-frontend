import { Link } from 'react-router-dom';
import { ErrorState, Loading } from '../../components/feedback/States';
import { buttonClassName } from '../../components/ui/button-styles';
import { useAuth } from '../../hooks/use-auth';
import { useCopy } from '../../hooks/use-copy';
import { GuestShell } from '../layouts/GuestShell';
import { TraderShell } from '../layouts/TraderShell';
import { AccountBlockedScreen } from './AccountBlockedScreen';
import { decideAccess } from './access-decision';

/**
 * Pages everyone may read (D-99: the community). A Trader reads them in
 * the Trader shell; a Guest, or anyone while the session cannot be
 * checked, in the Guest shell. Admins keep to their console, as on every
 * Trader route.
 */
export function ReaderRoute() {
  const auth = useAuth();
  const copy = useCopy();
  const decision = decideAccess(auth, { kind: 'roles', roles: ['Trader'] });
  switch (decision.type) {
    case 'loading':
      return <Loading label={copy.access.restoring} />;
    case 'unavailable':
    case 'login':
      return <GuestShell />;
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
      return <TraderShell />;
  }
}
