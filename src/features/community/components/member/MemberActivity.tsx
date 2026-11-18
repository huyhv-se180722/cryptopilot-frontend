import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  Heart,
  MessageSquare,
  MessagesSquare,
  Search,
  SquarePen,
  X,
} from 'lucide-react';
import { EmptyState, ErrorState } from '../../../../components/feedback/States';
import { Button } from '../../../../components/ui/Button';
import { Pagination } from '../../../../components/ui/Pagination';
import { Skeleton } from '../../../../components/ui/Skeleton';
import { useCopy } from '../../../../hooks/use-copy';
import { formatCopy } from '../../../../i18n/copy';
import { errorText } from '../../../../i18n/messages';
import type { MemberComment, PostPage } from '../../../../types/domain';
import { classNames } from '../../../../utils/class-names';
import { formatInstantUtc } from '../../../../utils/instant-format';
import {
  LIST_PAGE_SIZE,
  useFeedPage,
  useMemberComments,
  useMemberReactions,
} from '../../hooks/use-community';
import { PostCard } from '../PostCard';
import { postAge, postPath } from '../post-format';
import type { PostActions } from '../use-post-interactions';
import { MEMBER_TABS, type MemberTab } from './member-tabs';

/**
 * The middle column of a member page, as on CoinMarketCap Community
 * (D-99): "All Posts" with the Posts, Comments and Reactions tabs, a search
 * of the member's posts and, on one's own page, New Post. Each tab is one
 * numbered page at a time; an empty tab says so, and one's own empty Posts
 * tab invites the first post.
 */
export function MemberActivity({
  memberId,
  own,
  tab,
  onTab,
  page,
  onPage,
  query,
  onQuery,
  actions,
  onNewPost,
}: {
  memberId: string;
  own: boolean;
  tab: MemberTab;
  onTab: (tab: MemberTab) => void;
  page: number;
  onPage: (page: number) => void;
  query: string;
  onQuery: (query: string) => void;
  actions: PostActions;
  onNewPost: () => void;
}) {
  const m = useCopy().community.member;
  const [searching, setSearching] = useState(query !== '');
  const labels: Record<MemberTab, string> = {
    posts: m.tabPosts,
    comments: m.tabComments,
    reactions: m.tabReactions,
  };
  return (
    <section aria-labelledby="member-activity" className="min-w-0">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h2 id="member-activity" className="mr-auto text-xl font-bold text-fg">
          {m.allPosts}
        </h2>
        <div
          role="tablist"
          aria-label={m.tabsLabel}
          className="flex rounded-lg border border-line bg-raised p-0.5"
        >
          {MEMBER_TABS.map((each) => (
            <button
              key={each}
              type="button"
              role="tab"
              aria-selected={tab === each}
              onClick={() => onTab(each)}
              className={classNames(
                'h-7 rounded-md px-3 text-xs font-semibold transition-colors duration-150',
                tab === each
                  ? 'bg-surface text-fg shadow-sm'
                  : 'text-muted-x hover:text-fg-2',
              )}
            >
              {labels[each]}
            </button>
          ))}
        </div>
        {tab === 'posts' && (
          <SearchBox
            open={searching}
            onOpen={setSearching}
            query={query}
            onQuery={onQuery}
          />
        )}
        {own && (
          <button
            type="button"
            onClick={onNewPost}
            aria-label={m.newPost}
            title={m.newPost}
            className="inline-flex size-8 items-center justify-center rounded-lg border border-primary-line text-primary hover:bg-primary-soft"
          >
            <SquarePen size={14} aria-hidden="true" />
          </button>
        )}
      </div>
      {tab === 'posts' ? (
        <PostsTab
          memberId={memberId}
          own={own}
          page={page}
          onPage={onPage}
          query={query}
          actions={actions}
          onNewPost={onNewPost}
        />
      ) : tab === 'comments' ? (
        <CommentsTab memberId={memberId} page={page} onPage={onPage} />
      ) : (
        <ReactionsTab
          memberId={memberId}
          page={page}
          onPage={onPage}
          actions={actions}
        />
      )}
    </section>
  );
}

/** The search of the member's posts: an icon that opens a field (D-99). */
function SearchBox({
  open,
  onOpen,
  query,
  onQuery,
}: {
  open: boolean;
  onOpen: (open: boolean) => void;
  query: string;
  onQuery: (query: string) => void;
}) {
  const m = useCopy().community.member;
  // Starts from the URL's search; the field is mounted again with the tab.
  const [text, setText] = useState(query);
  // The feed searches 2 to 100 characters; the field waits for a pause.
  useEffect(() => {
    const value = text.trim();
    if (value === query || (value.length === 1 && query === '')) return;
    const timer = setTimeout(
      () => onQuery(value.length >= 2 ? value : ''),
      350,
    );
    return () => clearTimeout(timer);
  }, [text, query, onQuery]);
  if (!open)
    return (
      <button
        type="button"
        onClick={() => onOpen(true)}
        aria-label={m.searchLabel}
        title={m.searchLabel}
        className="inline-flex size-8 items-center justify-center rounded-lg border border-line bg-raised text-fg-2 hover:bg-raised-hover"
      >
        <Search size={14} aria-hidden="true" />
      </button>
    );
  return (
    <div className="flex h-8 w-full items-center gap-1.5 rounded-lg border border-line-strong bg-raised px-2 sm:w-56">
      <Search size={13} aria-hidden="true" className="text-muted-x" />
      <input
        autoFocus
        type="search"
        value={text}
        maxLength={100}
        onChange={(event) => setText(event.target.value)}
        aria-label={m.searchLabel}
        placeholder={m.searchPlaceholder}
        className="min-w-0 flex-1 bg-transparent text-xs text-fg outline-none placeholder:text-muted-x"
      />
      <button
        type="button"
        onClick={() => {
          setText('');
          onQuery('');
          onOpen(false);
        }}
        aria-label={m.searchClose}
        className="text-muted-x hover:text-fg-2"
      >
        <X size={13} aria-hidden="true" />
      </button>
    </div>
  );
}

function PostsTab({
  memberId,
  own,
  page,
  onPage,
  query,
  actions,
  onNewPost,
}: {
  memberId: string;
  own: boolean;
  page: number;
  onPage: (page: number) => void;
  query: string;
  actions: PostActions;
  onNewPost: () => void;
}) {
  const m = useCopy().community.member;
  const feed = useFeedPage(
    { tab: 'LATEST', author: memberId, ...(query ? { q: query } : {}) },
    page,
  );
  return (
    <PostGrid
      result={feed}
      page={page}
      onPage={onPage}
      actions={actions}
      empty={
        query ? (
          <EmptyState
            icon={Search}
            title={formatCopy(m.emptySearch, { q: query })}
          />
        ) : own ? (
          <EmptyState
            icon={MessageSquare}
            title={m.emptyTitle}
            description={m.emptyOwn}
            action={
              <Button onClick={onNewPost}>
                <SquarePen size={14} aria-hidden="true" />
                {m.newPost}
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={MessageSquare}
            title={m.emptyTitle}
            description={m.emptyPosts}
          />
        )
      }
    />
  );
}

function ReactionsTab({
  memberId,
  page,
  onPage,
  actions,
}: {
  memberId: string;
  page: number;
  onPage: (page: number) => void;
  actions: PostActions;
}) {
  const m = useCopy().community.member;
  return (
    <PostGrid
      result={useMemberReactions(memberId, page)}
      page={page}
      onPage={onPage}
      actions={actions}
      empty={
        <EmptyState
          icon={Heart}
          title={m.emptyTitle}
          description={m.emptyReactions}
        />
      }
    />
  );
}

/** Two post cards a row, then the pages, as the feed lays them out. */
function PostGrid({
  result,
  page,
  onPage,
  actions,
  empty,
}: {
  result: {
    data: PostPage | undefined;
    isPending: boolean;
    isError: boolean;
    isFetching: boolean;
    error: unknown;
    refetch: () => unknown;
  };
  page: number;
  onPage: (page: number) => void;
  actions: PostActions;
  empty: ReactNode;
}) {
  const copy = useCopy();
  if (result.isPending)
    return (
      <div className="grid items-start gap-4 md:grid-cols-2">
        {[0, 1, 2, 3].map((n) => (
          <Skeleton key={n} className="h-40 w-full rounded-2xl" />
        ))}
      </div>
    );
  if (result.isError)
    return (
      <ErrorState
        message={errorText(copy, result.error)}
        onRetry={() => void result.refetch()}
      />
    );
  const posts = result.data?.items ?? [];
  if (posts.length === 0) return <>{empty}</>;
  return (
    <div className="grid items-start gap-4 md:grid-cols-2">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} actions={actions} />
      ))}
      {result.data && (
        <div className="md:col-span-2">
          <Pagination
            page={page}
            total={result.data.total}
            pageSize={LIST_PAGE_SIZE}
            onChange={onPage}
            disabled={result.isFetching}
          />
        </div>
      )}
    </div>
  );
}

function CommentsTab({
  memberId,
  page,
  onPage,
}: {
  memberId: string;
  page: number;
  onPage: (page: number) => void;
}) {
  const copy = useCopy();
  const m = copy.community.member;
  const comments = useMemberComments(memberId, page);
  if (comments.isPending)
    return (
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((n) => (
          <Skeleton key={n} className="h-24 w-full rounded-2xl" />
        ))}
      </div>
    );
  if (comments.isError)
    return (
      <ErrorState
        message={errorText(copy, comments.error)}
        onRetry={() => void comments.refetch()}
      />
    );
  const items = comments.data.items;
  if (items.length === 0)
    return (
      <EmptyState
        icon={MessagesSquare}
        title={m.emptyTitle}
        description={m.emptyComments}
      />
    );
  return (
    <div className="flex flex-col gap-3">
      <ol className="flex flex-col gap-3">
        {items.map((comment) => (
          <li key={comment.commentId}>
            <CommentRow comment={comment} />
          </li>
        ))}
      </ol>
      <Pagination
        page={page}
        total={comments.data.total}
        pageSize={LIST_PAGE_SIZE}
        onChange={onPage}
        disabled={comments.isFetching}
      />
    </div>
  );
}

/** One comment with the post it answers, which opens on a click. */
function CommentRow({ comment }: { comment: MemberComment }) {
  const copy = useCopy();
  const m = copy.community.member;
  return (
    <article className="rounded-2xl border border-line bg-surface p-4">
      <p className="text-[13px] leading-relaxed whitespace-pre-line text-fg">
        {comment.content}
      </p>
      <Link
        to={postPath(comment.postId)}
        className="mt-3 block rounded-xl border border-line bg-raised px-3 py-2.5 no-underline transition-colors duration-150 hover:border-line-strong"
      >
        <span className="block text-[10px] font-semibold tracking-wide text-muted-x uppercase">
          {comment.reply ? m.repliedOn : m.commentedOn}
        </span>
        <span className="mt-0.5 block truncate text-xs font-semibold text-fg">
          {comment.postTitle}
        </span>
        <span className="mt-0.5 line-clamp-2 block text-[11px] text-muted-dim">
          {comment.postExcerpt}
        </span>
      </Link>
      <div className="mt-2.5 flex items-center gap-3 text-[11px] text-muted-x">
        <time
          dateTime={comment.createdAt}
          title={formatInstantUtc(comment.createdAt)}
        >
          {postAge(copy, comment.createdAt)}
        </time>
        <span className="inline-flex items-center gap-1">
          <Heart size={11} aria-hidden="true" />
          {formatCopy(m.commentLikes, { n: comment.likes })}
        </span>
      </div>
    </article>
  );
}
