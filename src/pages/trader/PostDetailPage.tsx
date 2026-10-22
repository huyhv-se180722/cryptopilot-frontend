import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, FileQuestion } from 'lucide-react';
import {
  Alert,
  EmptyState,
  ErrorState,
} from '../../components/feedback/States';
import { Skeleton } from '../../components/ui/Skeleton';
import { buttonClassName } from '../../components/ui/button-styles';
import { CommentSection } from '../../features/community/components/CommentSection';
import {
  CoinDiscussionCard,
  JoinCard,
  RulesCard,
} from '../../features/community/components/CommunitySidebar';
import { PostGallery } from '../../features/community/components/PostMediaView';
import {
  CoinTags,
  PostByline,
} from '../../features/community/components/PostParts';
import { ReactionBar } from '../../features/community/components/ReactionBar';
import { usePostInteractions } from '../../features/community/components/use-post-interactions';
import {
  useCoinDiscussion,
  usePost,
} from '../../features/community/hooks/use-community';
import { useCopy } from '../../hooks/use-copy';
import { errorText } from '../../i18n/messages';

/**
 * SCR-25 Post detail (SRS 3.7.1, 3.7.3): the full text and media, like
 * and save (BR-45), the author's Edit and Delete or anyone else's Report
 * (SCR-27), and the comments. A hidden post shows only to its author, with
 * a note (BR-47). Guests read it (D-99).
 */
export function PostDetailPage() {
  const { postId = '' } = useParams();
  const copy = useCopy();
  const c = copy.community;
  const navigate = useNavigate();
  const post = usePost(postId);
  const actions = usePostInteractions(() =>
    navigate('/community', { replace: true }),
  );
  const firstCoin = post.data?.coins[0];
  const discussion = useCoinDiscussion(firstCoin);

  const back = (
    <Link
      to="/community"
      className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-muted no-underline hover:text-fg-2"
    >
      <ArrowLeft size={13} aria-hidden="true" />
      {c.backToFeed}
    </Link>
  );

  if (post.isPending)
    return (
      <div className="mx-auto w-full max-w-6xl">
        {back}
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    );

  if (post.isError) {
    const notFound = (post.error as { status?: number } | null)?.status === 404;
    return (
      <div className="mx-auto w-full max-w-6xl">
        {back}
        {notFound ? (
          <EmptyState
            icon={FileQuestion}
            title={c.notFound}
            action={
              <Link to="/community" className={buttonClassName('secondary')}>
                {c.backToFeed}
              </Link>
            }
          />
        ) : (
          <ErrorState
            message={errorText(copy, post.error)}
            onRetry={() => void post.refetch()}
          />
        )}
      </div>
    );
  }

  const data = post.data;
  return (
    <div className="mx-auto w-full max-w-6xl">
      {back}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="min-w-0">
          <article
            aria-labelledby="post-title"
            className="rounded-2xl border border-line bg-surface p-4 sm:p-6"
          >
            {data.status === 'HIDDEN' && (
              <Alert tone="warning" title={c.hidden} className="mb-4">
                {c.hiddenNote}
              </Alert>
            )}
            <PostByline post={data} trailing={actions.menu(data)} />
            <h1
              id="post-title"
              className="mt-4 text-lg leading-snug font-semibold text-fg"
            >
              {data.title}
            </h1>
            <div className="mt-3 text-sm leading-relaxed break-words whitespace-pre-line text-fg-2">
              {data.content}
            </div>
            <PostGallery media={data.media} title={data.title} />
            {(data.coins.length > 0 || data.market) && (
              <div className="mt-4">
                <CoinTags coins={data.coins} market={data.market} />
              </div>
            )}
            <div className="mt-4 border-t border-line pt-3">
              <ReactionBar
                post={data}
                commentsTo="#comments"
                onReact={(action, active) =>
                  void actions.react(data.id, action, active)
                }
                pending={actions.reacting}
              />
            </div>
          </article>
          <CommentSection
            postId={data.id}
            canWrite={actions.trader}
            onGuest={actions.askToJoin}
          />
        </div>
        <aside className="flex flex-col gap-4">
          {firstCoin && (
            <CoinDiscussionCard
              symbol={firstCoin}
              discussion={discussion.data}
              loading={discussion.isPending}
            />
          )}
          {actions.role === 'guest' && <JoinCard />}
          <RulesCard />
        </aside>
      </div>
      {actions.dialogs}
    </div>
  );
}
