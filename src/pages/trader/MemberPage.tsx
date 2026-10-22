import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, MessageSquare, UserX } from 'lucide-react';
import { EmptyState, ErrorState } from '../../components/feedback/States';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { Badge } from '../../components/ui/Badge';
import { PostCard } from '../../features/community/components/PostCard';
import { AuthorAvatar } from '../../features/community/components/PostParts';
import { usePostInteractions } from '../../features/community/components/use-post-interactions';
import {
  useFeed,
  useMember,
} from '../../features/community/hooks/use-community';
import { useCopy } from '../../hooks/use-copy';
import { formatCopy } from '../../i18n/copy';
import { errorText } from '../../i18n/messages';
import {
  formatInstantLocal,
  formatInstantUtc,
} from '../../utils/instant-format';

/**
 * A member's public page (D-99, as on CoinMarketCap Community): name,
 * avatar, join date, posts and likes received, then their posts. Nothing
 * of their trading is shown. Guests read it.
 */
export function MemberPage() {
  const { memberId = '' } = useParams();
  const copy = useCopy();
  const c = copy.community;
  const member = useMember(memberId);
  const feed = useFeed({ tab: 'LATEST', author: memberId }, member.isSuccess);
  const actions = usePostInteractions();
  const posts = feed.data?.pages.flatMap((p) => p.items) ?? [];

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
      <div className="mx-auto w-full max-w-3xl">
        {back}
        <Skeleton className="h-32 w-full rounded-2xl" />
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
  const stats = [
    { label: c.member.posts, value: profile.posts },
    { label: c.member.likes, value: profile.likesReceived },
  ];
  return (
    <div className="mx-auto w-full max-w-3xl">
      {back}
      <section className="mb-6 flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-surface p-5">
        <AuthorAvatar author={profile} size={56} />
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 text-lg font-semibold text-fg">
            <span className="truncate">{profile.displayName}</span>
            {profile.me && <Badge tone="info">{c.member.you}</Badge>}
          </h1>
          <p className="mt-0.5 text-xs text-muted-dim">
            <time
              dateTime={profile.joinedAt}
              title={formatInstantUtc(profile.joinedAt)}
            >
              {formatCopy(c.member.joined, {
                date: formatInstantLocal(profile.joinedAt).slice(0, 10),
              })}
            </time>
          </p>
        </div>
        <dl className="flex gap-6">
          {stats.map((stat) => (
            <div key={stat.label} className="text-right">
              <dt className="text-[10px] font-semibold tracking-widest text-muted-x uppercase">
                {stat.label}
              </dt>
              <dd className="font-mono text-base font-semibold text-fg">
                {stat.value}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="grid gap-3">
        {feed.isPending ? (
          [0, 1].map((n) => (
            <Skeleton key={n} className="h-40 w-full rounded-2xl" />
          ))
        ) : feed.isError ? (
          <ErrorState
            message={errorText(copy, feed.error)}
            onRetry={() => void feed.refetch()}
          />
        ) : posts.length === 0 ? (
          <EmptyState icon={MessageSquare} title={c.empty} />
        ) : (
          posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              menu={actions.menu(post)}
              onReact={(action, active) =>
                void actions.react(post.id, action, active)
              }
              pending={actions.reacting}
            />
          ))
        )}
        {feed.hasNextPage && (
          <div className="flex justify-center">
            <Button
              variant="secondary"
              disabled={feed.isFetchingNextPage}
              onClick={() => void feed.fetchNextPage()}
            >
              {c.loadMore}
            </Button>
          </div>
        )}
      </div>
      {actions.dialogs}
    </div>
  );
}
