import { useCallback } from 'react';
import {
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query';
import { useAuth } from '../../../hooks/use-auth';
import { useMutation } from '../../../hooks/use-mutation';
import { useServices } from '../../../hooks/use-services';
import type { ReactionTarget } from '../../../services/api/contracts';
import type {
  CommentPage,
  Engagement,
  FeedQuery,
  InfluencerRank,
  MemberProfile,
  OfficialCategory,
  PostComment,
  PostDetail,
  PostDraft,
  PostMediaKind,
  PostPage,
  PostReport,
  PostSentiment,
  PostSummary,
} from '../../../types/domain';

export const COMMUNITY_KEY = ['community'] as const;
const FEED_KEY = [...COMMUNITY_KEY, 'feed'] as const;
const postKey = (id: string) => [...COMMUNITY_KEY, 'post', id] as const;
const commentsKey = (id: string) => [...COMMUNITY_KEY, 'comments', id] as const;

/** Twenty comments a page, as the backend's default (CR-04). */
const COMMENT_PAGE_SIZE = 20;

const nextPage = (last: { page: number; pageSize: number; total: number }) =>
  last.page * last.pageSize < last.total ? last.page + 1 : undefined;

/** A Trader may write, react and report; a Guest only reads (D-99). */
export function useCommunityRole(): 'trader' | 'guest' | 'other' {
  const session = useAuth().session;
  if (!session) return 'guest';
  return session.user.role === 'Trader' ? 'trader' : 'other';
}

export type FeedFilter = Omit<FeedQuery, 'page' | 'pageSize'>;

/** Cards per numbered page of the community lists (CR-04). */
export const LIST_PAGE_SIZE = 10;

/**
 * One numbered page of a feed tab (SCR-24); the page shown stays while the
 * next one loads.
 */
export function useFeedPage(filter: FeedFilter, page: number, enabled = true) {
  const { community } = useServices();
  return useQuery({
    queryKey: [...FEED_KEY, filter, { page }],
    enabled,
    placeholderData: keepPreviousData,
    queryFn: ({ signal }) =>
      community.feed({ ...filter, page, pageSize: LIST_PAGE_SIZE }, signal),
  });
}

/** One numbered page of the team's official posts of a category (D-99). */
export function useArticlesPage(
  category: OfficialCategory | undefined,
  page: number,
) {
  const { community } = useServices();
  return useQuery({
    // Under the feed key, so reactions and new posts reach it like a feed.
    queryKey: [...FEED_KEY, { articles: category ?? 'ALL' }, { page }],
    placeholderData: keepPreviousData,
    queryFn: ({ signal }) =>
      community.pinned(
        {
          ...(category ? { category } : {}),
          page,
          pageSize: LIST_PAGE_SIZE,
        },
        signal,
      ),
  });
}

/** A cached feed is a numbered page or the pages of a Load more list. */
type CachedFeed = PostPage | InfiniteData<PostPage>;
function mapFeed(
  data: CachedFeed | undefined,
  patch: <T extends PostSummary>(post: T) => T,
): CachedFeed | undefined {
  if (!data) return data;
  if ('pages' in data)
    return {
      ...data,
      pages: data.pages.map((p) => ({ ...p, items: p.items.map(patch) })),
    };
  return { ...data, items: data.items.map(patch) };
}

/** The published announcements pinned above the feed (BR-61). */
export function usePinnedPosts() {
  const { community } = useServices();
  return useQuery({
    queryKey: [...COMMUNITY_KEY, 'pinned'],
    queryFn: ({ signal }) => community.pinned({ page: 1, pageSize: 5 }, signal),
  });
}

export function usePost(id: string) {
  const { community } = useServices();
  return useQuery({
    queryKey: postKey(id),
    queryFn: ({ signal }) => community.post(id, signal),
  });
}

/** A post's threads, oldest first, each with its replies (SCR-25). */
export function useComments(postId: string, enabled = true) {
  const { community } = useServices();
  return useInfiniteQuery({
    queryKey: commentsKey(postId),
    enabled,
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      community.comments(postId, pageParam, COMMENT_PAGE_SIZE, signal),
    getNextPageParam: nextPage,
  });
}

export function useMember(id: string) {
  const { community } = useServices();
  return useQuery({
    queryKey: [...COMMUNITY_KEY, 'member', id],
    queryFn: ({ signal }) => community.member(id, signal),
  });
}

/** How much the community talks about a coin (D-99). */
export function useCoinDiscussion(symbol: string | undefined) {
  const { community } = useServices();
  return useQuery({
    queryKey: [...COMMUNITY_KEY, 'coin', symbol],
    enabled: Boolean(symbol),
    queryFn: ({ signal }) => community.coinDiscussion(symbol ?? '', signal),
  });
}

/** Top Influencers by influence or analytical depth (D-99). */
export function useInfluencers(rank: InfluencerRank, limit = 8) {
  const { community } = useServices();
  return useQuery({
    queryKey: [...COMMUNITY_KEY, 'influencers', rank, limit],
    queryFn: ({ signal }) => community.influencers(rank, limit, signal),
  });
}

/** The coins the week's posts talk about most (D-99). */
export function useTrendingCoins(limit = 20) {
  const { community } = useServices();
  return useQuery({
    queryKey: [...COMMUNITY_KEY, 'trending-coins', limit],
    queryFn: ({ signal }) => community.trendingCoins(limit, signal),
  });
}

/** Members whose name starts with the text; a Trader's search (D-99). */
export function useMemberSearch(text: string, enabled: boolean) {
  const { community } = useServices();
  const q = text.trim();
  return useQuery({
    queryKey: [...COMMUNITY_KEY, 'member-search', q],
    enabled: enabled && q.length > 0 && q.length <= 50,
    queryFn: ({ signal }) => community.searchMembers(q, signal),
  });
}

/** Applies `change` to every cached copy of the posts `which` picks. */
function patchPosts(
  client: QueryClient,
  which: (post: PostSummary | PostDetail) => boolean,
  change: <T extends PostSummary | PostDetail>(post: T) => T,
) {
  const patch = <T extends PostSummary | PostDetail>(post: T): T =>
    which(post) ? change(post) : post;
  client.setQueriesData<CachedFeed>({ queryKey: FEED_KEY }, (data) =>
    mapFeed(data, patch),
  );
  client.setQueriesData<PostPage>(
    { queryKey: [...COMMUNITY_KEY, 'pinned'] },
    (data) => data && { ...data, items: data.items.map(patch) },
  );
  client.setQueriesData<PostDetail>(
    { queryKey: [...COMMUNITY_KEY, 'post'] },
    (post) => post && patch(post),
  );
}

/**
 * A Bullish or Bearish vote, or null to take it back (D-99). The counts
 * change when the server answers.
 */
export function useVote() {
  const { community } = useServices();
  const client = useQueryClient();
  return useMutation(
    useCallback(
      async (postId: string, sentiment: PostSentiment | null) => {
        const result = await community.vote(postId, sentiment);
        patchPosts(
          client,
          (post) => post.id === postId,
          (post) => ({ ...post, ...result }),
        );
        return result;
      },
      [community, client],
    ),
  );
}

/**
 * Follows a member or stops (D-99): every card of theirs, their page and
 * the influencer list follow the server's answer; the Following tab reads
 * again.
 */
export function useFollow() {
  const { community } = useServices();
  const client = useQueryClient();
  return useMutation(
    useCallback(
      async (memberId: string, active: boolean) => {
        const result = await community.follow(memberId, active);
        patchPosts(
          client,
          (post) => post.author.userId === memberId,
          (post) => ({
            ...post,
            authorStanding: {
              ...post.authorStanding,
              followedByMe: result.active,
              followers: result.count,
            },
          }),
        );
        client.setQueryData<MemberProfile>(
          [...COMMUNITY_KEY, 'member', memberId],
          (member) =>
            member && {
              ...member,
              followedByMe: result.active,
              followers: result.count,
            },
        );
        void client.invalidateQueries({
          queryKey: [...COMMUNITY_KEY, 'influencers'],
        });
        void client.invalidateQueries({
          queryKey: FEED_KEY,
          predicate: (q) =>
            (q.queryKey[2] as FeedFilter | undefined)?.tab === 'FOLLOWING',
        });
        return result;
      },
      [community, client],
    ),
  );
}

/** Blocks a member or stops (D-99); everything of the community reads again. */
export function useBlock() {
  const { community } = useServices();
  const client = useQueryClient();
  return useMutation(
    useCallback(
      async (memberId: string, active: boolean) => {
        const result = await community.block(memberId, active);
        await client.invalidateQueries({ queryKey: COMMUNITY_KEY });
        return result;
      },
      [community, client],
    ),
  );
}

/** Writes the server's answer to a post reaction into every cached copy. */
function applyPostReaction(
  client: QueryClient,
  id: string,
  action: 'like' | 'save',
  result: Engagement,
) {
  const patch = <T extends { id: string }>(post: T): T =>
    post.id !== id
      ? post
      : action === 'like'
        ? { ...post, likedByMe: result.active, likeCount: result.count }
        : { ...post, savedByMe: result.active };
  client.setQueriesData<CachedFeed>({ queryKey: FEED_KEY }, (data) =>
    mapFeed(data, patch),
  );
  client.setQueriesData<PostPage>(
    { queryKey: [...COMMUNITY_KEY, 'pinned'] },
    (data) => data && { ...data, items: data.items.map(patch) },
  );
  client.setQueryData<PostDetail>(postKey(id), (post) => post && patch(post));
}

function applyCommentLike(client: QueryClient, id: string, result: Engagement) {
  const patch = (comment: PostComment): PostComment =>
    comment.id === id
      ? { ...comment, likedByMe: result.active, likeCount: result.count }
      : { ...comment, replies: comment.replies.map(patch) };
  client.setQueriesData<InfiniteData<CommentPage>>(
    { queryKey: [...COMMUNITY_KEY, 'comments'] },
    (data) =>
      data && {
        ...data,
        pages: data.pages.map((p) => ({ ...p, items: p.items.map(patch) })),
      },
  );
}

/**
 * Like and save toggles (BR-45). Counts change when the server answers,
 * never before; a save also reads the Saved tab again.
 */
export function useReaction() {
  const { community } = useServices();
  const client = useQueryClient();
  return useMutation(
    useCallback(
      async (target: ReactionTarget, active: boolean) => {
        const result = await community.react(target, active);
        if (target.kind === 'post') {
          applyPostReaction(client, target.id, target.action, result);
          if (target.action === 'save')
            void client.invalidateQueries({
              queryKey: FEED_KEY,
              predicate: (q) =>
                (q.queryKey[2] as FeedFilter | undefined)?.tab === 'SAVED',
            });
        } else applyCommentLike(client, target.id, result);
        return result;
      },
      [community, client],
    ),
  );
}

/** Publishes a new post or saves an edit (UC-27, UC-29). */
export function useSavePost(id?: string) {
  const { community } = useServices();
  const client = useQueryClient();
  return useMutation(
    useCallback(
      async (draft: PostDraft) => {
        const post = id
          ? await community.update(id, draft)
          : await community.create(draft);
        client.setQueryData(postKey(post.id), post);
        await client.invalidateQueries({ queryKey: FEED_KEY });
        return post;
      },
      [community, client, id],
    ),
  );
}

/** Soft delete of an own post (BR-47). */
export function useDeletePost() {
  const { community } = useServices();
  const client = useQueryClient();
  return useMutation(
    useCallback(
      async (id: string) => {
        await community.remove(id);
        client.removeQueries({ queryKey: postKey(id) });
        await client.invalidateQueries({ queryKey: FEED_KEY });
      },
      [community, client],
    ),
  );
}

/** Comment, reply, edit and delete; the thread and its count read again. */
export function useCommentActions(postId: string) {
  const { community } = useServices();
  const client = useQueryClient();
  const refresh = useCallback(async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: commentsKey(postId) }),
      client.invalidateQueries({ queryKey: postKey(postId) }),
    ]);
  }, [client, postId]);
  const add = useMutation(
    useCallback(
      async (content: string, parentCommentId: string | null) => {
        const comment = await community.comment(
          postId,
          content,
          parentCommentId,
        );
        await refresh();
        return comment;
      },
      [community, postId, refresh],
    ),
  );
  const edit = useMutation(
    useCallback(
      async (id: string, content: string) => {
        const comment = await community.editComment(id, content);
        await refresh();
        return comment;
      },
      [community, refresh],
    ),
  );
  const remove = useMutation(
    useCallback(
      async (id: string) => {
        await community.removeComment(id);
        await refresh();
      },
      [community, refresh],
    ),
  );
  return { add, edit, remove };
}

/** Reports a post that is not the caller's (UC-33). */
export function useReportPost() {
  const { community } = useServices();
  return useMutation(
    useCallback(
      (postId: string, report: PostReport) => community.report(postId, report),
      [community],
    ),
  );
}

/** Uploads one file of the post form (D-98); the form keeps the key. */
export function useMediaUpload() {
  const { community } = useServices();
  return useCallback(
    (
      file: File,
      kind: PostMediaKind,
      onProgress: (share: number) => void,
      signal: AbortSignal,
    ) => community.upload(file, kind, onProgress, signal),
    [community],
  );
}
