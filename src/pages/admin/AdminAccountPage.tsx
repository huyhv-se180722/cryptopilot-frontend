import { PageHeader } from '../../components/layout/PageHeader';
import { useCopy } from '../../hooks/use-copy';
import { ChangePasswordForm } from '../../features/auth/components/ChangePasswordForm';

/** SCR-07 for an Admin: the Security tab only (SRS 3.2.5). */
export function AdminAccountPage() {
  const copy = useCopy();
  return (
    <div className="w-full max-w-4xl">
      <PageHeader
        size="sm"
        title={copy.screens.adminAccount}
        description={copy.profile.securitySubtitle}
      />
      <ChangePasswordForm />
    </div>
  );
}
