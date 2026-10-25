import { ErrorState } from '../../components/feedback/States';
import { PageHeader } from '../../components/layout/PageHeader';
import { Skeleton } from '../../components/ui/Skeleton';
import { SettingsForm } from '../../features/admin/components/SettingsForm';
import { useAdminSettings } from '../../features/admin/hooks/use-admin-settings';
import { useCopy } from '../../hooks/use-copy';
import { errorText } from '../../i18n/messages';

/**
 * SCR-43 System Settings (SRS 3.11.8, UC-51): fees, plan warnings and
 * limits by group, each checked against its type and range. Layout of
 * the missing-screen spec (no Figma frame); data from the API.
 */
export function AdminSettingsPage() {
  const copy = useCopy();
  const t = copy.adminSettings;
  const settings = useAdminSettings();
  return (
    <div className="w-full max-w-5xl">
      <PageHeader size="sm" title={t.title} description={t.subtitle} />
      {settings.isPending ? (
        <div className="grid gap-4">
          {['a', 'b', 'c'].map((k) => (
            <Skeleton key={k} className="h-48 w-full" />
          ))}
        </div>
      ) : settings.isError ? (
        <ErrorState
          message={errorText(copy, settings.error)}
          onRetry={() => void settings.refetch()}
        />
      ) : (
        <SettingsForm settings={settings.data} />
      )}
    </div>
  );
}
