import { Outlet } from 'react-router-dom';
import { IntegrationBanner } from '../../components/layout/IntegrationBanner';
import { useCopy } from '../../hooks/use-copy';
import { DocumentTitle } from './DocumentTitle';

/** Root route host: skip link, document title and integration status. */
export function RouteFrame() {
  const copy = useCopy();
  return (
    <>
      <DocumentTitle />
      <a
        className="fixed -top-24 left-4 z-[100] rounded-lg bg-surface p-3 text-fg shadow-overlay focus:top-3"
        href="#main-content"
      >
        {copy.common.skipToContent}
      </a>
      <IntegrationBanner />
      <Outlet />
    </>
  );
}
