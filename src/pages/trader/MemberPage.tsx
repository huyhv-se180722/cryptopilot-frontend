import { useCallback, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, UserX } from 'lucide-react';
import { EmptyState, ErrorState } from '../../components/feedback/States';
import { Skeleton } from '../../components/ui/Skeleton';
import { CommunityFrame } from '../../features/community/components/CommunityFrame';
import { EditMemberProfileDialog } from '../../features/community/components/member/EditMemberProfileDialog';
import { MemberActivity } from '../../features/community/components/member/MemberActivity';
import {
  MEMBER_TABS,
  type MemberTab,
} from '../../features/community/components/member/member-tabs';
import {
  SocialInsightsCard,
  TokenMentionsCard,
} from '../../features/community/components/member/MemberInsights';
import { MemberProfileCard } from '../../features/community/components/member/MemberProfileCard';
import { usePostInteractions } from '../../features/community/components/use-post-interactions';
import { useMember } from '../../features/community/hooks/use-community';
import { useCopy } from '../../hooks/use-copy';
import { useToast } from '../../hooks/use-toast';
import { errorText } from '../../i18n/messages';

/**
 * A member's page, as on CoinMarketCap Community (D-99): on the left the
 * member's card (banner, avatar, introduction, link, follows), Social
 * Insights and Token Mentions; in the middle All Posts with the Posts,
 * Comments and Reactions tabs; on the right the pinned posts and Other
 * Influencers. Nothing of their trading is shown. Guests read it; "My
 * Page" is the Trader's own, where Edit opens the profile dialog. The tab,
 * page and search live in the URL.
 */
export function MemberPage() {
  const { memberId = '' } = useParams();
  const copy = useCopy();
  const c = copy.community;
  const { show } = useToast();
  const member = useMember(memberId);
  const actions = usePostInteractions();
  const [params, setParams] = useSearchParams();
  const [editing, setEditing] = useState(false);

  const requested = params.get('tab') as MemberTab | null;
  const tab: MemberTab =
    requested && MEMBER_TABS.includes(requested) ? requested : 'posts';
  const page = Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1);
  const query = params.get('q') ?? '';

  // Any change but the page itself starts again from the first page.
  const update = useCallback(
    (next: Record<string, string>) =>
      setParams(
        (current) => {
          const out = new URLSearchParams(current);
          if (!('page' in next)) out.delete('page');
          for (const [key, value] of Object.entries(next)) {
            if (value === '' || (key === 'tab' && value === 'posts'))
              out.delete(key);
            else out.set(key, value);
          }
          return out;
        },
        { replace: true },
      ),
    [setParams],
  );
  const onQuery = useCallback((q: string) => update({ q }), [update]);

  const copyLink = () => {
    const url = window.location.origin + window.location.pathname;
    navigator.clipboard?.writeText(url).then(
      () => show({ tone: 'success', message: c.member.linkCopied }),
      () => undefined,
    );
  };

  const back = (
    <Link
      to="/community"
      className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-muted no-underline hover:text-fg-2"
    >
      <ArrowLeft size={13} aria-hidden="true" />
      {c.backToFeed}
    </Link>
  );

  if (member.isPending)
    return (
      <div className="grid w-full gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-80 w-full rounded-2xl" />
          <Skeleton className="h-28 w-full rounded-2xl" />
        </div>
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  if (member.isError) {
    const notFound =
      (member.error as { status?: number } | null)?.status === 404;
    return (
      <div className="mx-auto w-full max-w-3xl">
        {back}
        {notFound ? (
          <EmptyState icon={UserX} title={copy.messages.MSG41} />
        ) : (
          <ErrorState
            message={errorText(copy, member.error)}
            onRetry={() => void member.refetch()}
          />
        )}
      </div>
    );
  }

  const profile = member.data;
  return (
    <CommunityFrame
      actions={actions}
      member={profile.userId}
      left={
        <>
          <MemberProfileCard
            profile={profile}
            actions={actions}
            onEdit={() => setEditing(true)}
            onCopyLink={copyLink}
          />
          <SocialInsightsCard profile={profile} />
          <TokenMentionsCard memberId={profile.userId} />
        </>
      }
    >
      {(openComposer) => (
        <>
          <MemberActivity
            memberId={profile.userId}
            own={profile.me && actions.trader}
            tab={tab}
            onTab={(next) => update({ tab: next, q: '' })}
            page={page}
            onPage={(next) => {
              update({ page: String(next) });
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            query={query}
            onQuery={onQuery}
            actions={actions}
            onNewPost={openComposer}
          />
          {profile.me && (
            <EditMemberProfileDialog open={editing} onOpenChange={setEditing} />
          )}
        </>
      )}
    </CommunityFrame>
  );
}
