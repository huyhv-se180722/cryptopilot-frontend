import { FlaskConical, PlugZap } from 'lucide-react';
import { useCopy } from '../../hooks/use-copy';
import { useIntegrationMode } from '../../hooks/use-integration-mode';

/** Thin strip stating that data is isolated fixtures or not connected yet. */
export function IntegrationBanner() {
  const mode = useIntegrationMode();
  const copy = useCopy();
  if (mode === 'backend') return null;
  const fixtures = mode === 'development-fixtures';
  const Icon = fixtures ? FlaskConical : PlugZap;
  return (
    <div
      role="status"
      className="flex items-center gap-2 border-b border-warning-line bg-warning-soft px-4 py-1.5 text-[11px] text-warning sm:px-6"
    >
      <Icon size={12} aria-hidden="true" className="shrink-0" />
      <strong className="font-semibold">
        {fixtures
          ? copy.integration.fixturesTitle
          : copy.integration.pendingTitle}
      </strong>
      <span className="hidden text-fg-2 sm:inline">
        {fixtures
          ? copy.integration.fixturesBody
          : copy.integration.pendingBody}
      </span>
    </div>
  );
}
