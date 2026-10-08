import { FlaskConical, PlugZap } from 'lucide-react';
import { useCopy } from '../../hooks/use-copy';
import { useIntegrationMode } from '../../hooks/use-integration-mode';
import { useAuth } from '../../hooks/use-auth';

/** Thin strip stating that data is isolated fixtures or not connected yet. */
export function IntegrationBanner() {
  const mode = useIntegrationMode();
  const copy = useCopy();
  const session = useAuth().session;
  if (mode === 'backend') return null;
  const fixtures = mode === 'development-fixtures';
  const Icon = fixtures ? FlaskConical : PlugZap;
  return (
    <div
      role="status"
      className="flex h-(--cp-banner-h) items-center gap-2 overflow-hidden border-b border-warning-line bg-warning-soft px-4 text-[11px] text-warning sm:px-6"
    >
      <Icon size={12} aria-hidden="true" className="shrink-0" />
      <strong className="shrink-0 font-semibold whitespace-nowrap">
        {fixtures
          ? copy.integration.fixturesTitle
          : copy.integration.pendingTitle}
      </strong>
      <span className="hidden min-w-0 truncate text-fg-2 sm:inline">
        {fixtures
          ? copy.integration.fixturesBody
          : copy.integration.pendingBody}
      </span>
      {fixtures && session && (
        <span className="ml-auto min-w-0 truncate rounded-full border border-warning-line px-2 font-mono text-[10px] font-semibold tracking-wider">
          {copy.integration.devSession}
          {/* The email needs the room of sm and up; the badge stays. */}
          <span className="hidden sm:inline"> · {session.user.email}</span>
        </span>
      )}
    </div>
  );
}
