import { Link, Outlet } from 'react-router-dom';
import { Warning } from '../../components/feedback/States';
import { useIntegrationMode } from '../../hooks/use-integration-mode';
import { useCopy } from '../../hooks/use-copy';

/** Minimal route host; the application shell belongs to feature/app-shell. */
export function RouteFrame() {
  const mode = useIntegrationMode();
  const copy = useCopy();
  return (
    <>
      <a className="skip-link" href="#main-content">
        {copy.common.skipToContent}
      </a>
      <div className="foundation-container">
        <Link className="wordmark" to="/">
          {copy.product.name}
        </Link>
        {mode === 'development-fixtures' && (
          <Warning title={copy.integration.fixturesTitle}>
            {copy.integration.fixturesBody}
          </Warning>
        )}
        {mode === 'backend-pending' && (
          <Warning title={copy.integration.pendingTitle}>
            {copy.integration.pendingBody}
          </Warning>
        )}
        <main id="main-content" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </>
  );
}
