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
      <a
        className="fixed -top-24 left-4 z-[100] rounded-lg bg-surface p-3 text-fg shadow-overlay focus:top-3"
        href="#main-content"
      >
        {copy.common.skipToContent}
      </a>
      <div className="mx-auto max-w-[1120px] p-4 sm:p-6">
        <Link
          className="mb-6 inline-block text-lg font-semibold no-underline"
          to="/"
        >
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
