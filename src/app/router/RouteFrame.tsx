import { Link, Outlet } from 'react-router-dom';
import { Warning } from '../../components/feedback/States';
import { useIntegrationMode } from '../../hooks/use-integration-mode';

/** Minimal route host; the application shell belongs to feature/app-shell. */
export function RouteFrame() {
  const mode = useIntegrationMode();
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <div className="foundation-container">
        <Link className="wordmark" to="/">
          CryptoPilot
        </Link>
        {mode === 'development-fixtures' && (
          <Warning title="Development fixtures enabled">
            Isolated test data; no live backend connection.
          </Warning>
        )}
        {mode === 'backend-pending' && (
          <Warning title="Backend integration pending">
            Routes and services are prepared. Live data and sign in are not
            connected.
          </Warning>
        )}
        <main id="main-content" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </>
  );
}
