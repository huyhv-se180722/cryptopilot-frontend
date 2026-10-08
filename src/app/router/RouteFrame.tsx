import { Outlet } from 'react-router-dom';
import { IntegrationBanner } from '../../components/layout/IntegrationBanner';
import type { CSSProperties } from 'react';
import { useCopy } from '../../hooks/use-copy';
import { useIntegrationMode } from '../../hooks/use-integration-mode';
import { DocumentTitle } from './DocumentTitle';
import { SessionExpiredDialog } from '../../features/auth/components/SessionExpiredDialog';

/** Root route host: skip link, document title and integration status. */
export function RouteFrame() {
  const copy = useCopy();
  const bannerShown = useIntegrationMode() !== 'backend';
  // Shells subtract the status strip from full-height regions (admin sidebar).
  const frameStyle = {
    '--cp-banner-h': bannerShown ? '30px' : '0px',
  } as CSSProperties;
  return (
    <div style={frameStyle}>
      <DocumentTitle />
      <a
        className="fixed -top-24 left-4 z-[100] rounded-lg bg-surface p-3 text-fg shadow-overlay focus:top-3"
        href="#main-content"
      >
        {copy.common.skipToContent}
      </a>
      <IntegrationBanner />
      <Outlet />
      <SessionExpiredDialog />
    </div>
  );
}
