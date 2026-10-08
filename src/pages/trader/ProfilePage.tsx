import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ErrorState, Loading } from '../../components/feedback/States';
import { PageHeader } from '../../components/layout/PageHeader';
import { Tabs } from '../../components/ui/Tabs';
import { useCopy } from '../../hooks/use-copy';
import { errorText } from '../../i18n/messages';
import { ChangePasswordForm } from '../../features/auth/components/ChangePasswordForm';
import { NotificationsForm } from '../../features/profile/components/NotificationsForm';
import { ProfileForm } from '../../features/profile/components/ProfileForm';
import { RiskProfileSection } from '../../features/profile/components/RiskProfileSection';
import { SubscriptionSummary } from '../../features/profile/components/SubscriptionSummary';
import {
  useProfileData,
  type ProfileData,
} from '../../features/profile/hooks/use-profile';

const TABS = ['profile', 'security', 'notifications', 'subscription'] as const;
type Tab = (typeof TABS)[number];

/** SCR-07 Profile & Settings (SRS 3.2.5): four tabs, `?tab=` keeps the choice. */
export function ProfilePage() {
  const copy = useCopy();
  const p = copy.profile;
  const [params, setParams] = useSearchParams();
  const requested = params.get('tab');
  const tab: Tab = TABS.includes(requested as Tab)
    ? (requested as Tab)
    : 'profile';
  const { state, reload } = useProfileData();

  const withData = (render: (data: ProfileData) => ReactNode) =>
    state.status === 'loading' ? (
      <Loading />
    ) : state.status === 'error' ? (
      <ErrorState message={errorText(copy, state.error)} onRetry={reload} />
    ) : (
      render(state.data)
    );

  return (
    <div className="mx-auto w-full max-w-4xl">
      <PageHeader title={copy.screens.profile} description={p.subtitle} />
      <Tabs
        label={p.tabsLabel}
        value={tab}
        onChange={(id) => setParams({ tab: id }, { replace: true })}
        items={[
          {
            id: 'profile',
            label: p.tabProfile,
            panel: withData(({ profile, risk }) => (
              <>
                <ProfileForm profile={profile} onSaved={reload} />
                <div className="mt-5">
                  <RiskProfileSection risk={risk} onSaved={reload} />
                </div>
              </>
            )),
          },
          {
            id: 'security',
            label: p.tabSecurity,
            panel: <ChangePasswordForm />,
          },
          {
            id: 'notifications',
            label: p.tabNotifications,
            panel: withData(({ profile }) => (
              <NotificationsForm profile={profile} onSaved={reload} />
            )),
          },
          {
            id: 'subscription',
            label: p.tabSubscription,
            panel: <SubscriptionSummary />,
          },
        ]}
      />
    </div>
  );
}
