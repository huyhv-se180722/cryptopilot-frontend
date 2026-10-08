import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bell, CreditCard, Shield, UserRound } from 'lucide-react';
import { ErrorState } from '../../components/feedback/States';
import { PageHeader } from '../../components/layout/PageHeader';
import { Tabs } from '../../components/ui/Tabs';
import { useCopy } from '../../hooks/use-copy';
import { errorText } from '../../i18n/messages';
import { ChangePasswordForm } from '../../features/auth/components/ChangePasswordForm';
import { NotificationsForm } from '../../features/profile/components/NotificationsForm';
import { ProfileForm } from '../../features/profile/components/ProfileForm';
import { RiskProfileSection } from '../../features/profile/components/RiskProfileSection';
import { SettingsSkeleton } from '../../features/profile/components/SettingsSkeleton';
import { SubscriptionSummary } from '../../features/profile/components/SubscriptionSummary';
import {
  useProfileData,
  type ProfileData,
} from '../../features/profile/hooks/use-profile';

const TABS = ['profile', 'security', 'notifications', 'subscription'] as const;
type Tab = (typeof TABS)[number];

/**
 * SCR-07 Profile & Settings (SRS 3.2.5): four tabs in the vertical list of
 * the Figma Settings frame, `?tab=` keeps the choice.
 */
export function ProfilePage() {
  const copy = useCopy();
  const p = copy.profile;
  const [params, setParams] = useSearchParams();
  const requested = params.get('tab');
  const tab: Tab = TABS.includes(requested as Tab)
    ? (requested as Tab)
    : 'profile';
  const { state, reload } = useProfileData();

  const withData = (render: (data: ProfileData) => ReactNode, cards: number) =>
    state.status === 'loading' ? (
      <SettingsSkeleton cards={cards} />
    ) : state.status === 'error' ? (
      <ErrorState message={errorText(copy, state.error)} onRetry={reload} />
    ) : (
      render(state.data)
    );

  return (
    <div className="mx-auto w-full max-w-5xl">
      <PageHeader title={copy.screens.profile} description={p.subtitle} />
      <Tabs
        orientation="vertical"
        label={p.tabsLabel}
        value={tab}
        onChange={(id) => setParams({ tab: id }, { replace: true })}
        items={[
          {
            id: 'profile',
            label: p.tabProfile,
            icon: <UserRound size={15} />,
            panel: withData(
              ({ profile, risk }) => (
                <>
                  <ProfileForm profile={profile} onSaved={reload} />
                  <div className="mt-5">
                    <RiskProfileSection risk={risk} onSaved={reload} />
                  </div>
                </>
              ),
              3,
            ),
          },
          {
            id: 'security',
            label: p.tabSecurity,
            icon: <Shield size={15} />,
            panel: <ChangePasswordForm />,
          },
          {
            id: 'notifications',
            label: p.tabNotifications,
            icon: <Bell size={15} />,
            panel: withData(
              ({ profile }) => (
                <NotificationsForm profile={profile} onSaved={reload} />
              ),
              1,
            ),
          },
          {
            id: 'subscription',
            label: p.tabSubscription,
            icon: <CreditCard size={15} />,
            panel: <SubscriptionSummary />,
          },
        ]}
      />
    </div>
  );
}
