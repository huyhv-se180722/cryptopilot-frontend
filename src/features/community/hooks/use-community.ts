import { useCallback } from 'react';
import {
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
  PostComment,
  PostDetail,
  PostDraft,
  PostMediaKind,
  PostPage,
  PostReport,
} from '../../../types/domain';

export const COMMUNITY_KEY = ['community'] as const;
const FEED_KEY = [...COMMUNITY_KEY, 'feed'] as const;
const postKey = (id: string) => [...COMMUNITY_KEY, 'post', id] as const;
const commentsKey = (id: string) => [...COMMUNITY_KEY, 'comments', id] as const;

/** Twenty cards a page, as the backend's default (CR-04). */
export const FEED_PAGE_SIZE = 20;
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

/** One feed tab, read a page at a time (SCR-24). */
export function useFeed(filter: FeedFilter, enabled = true) {
  const { community } = useServices();
  return useInfiniteQuery({
    queryKey: [...FEED_KEY, filter],
    enabled,
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      community.feed(
        { ...filter, page: pageParam, pageSize: FEED_PAGE_SIZE },
        signal,
      ),
    getNextPageParam: nextPage,
  });
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
  client.setQueriesData<InfiniteData<PostPage>>(
    { queryKey: FEED_KEY },
    (data) =>
      data && {
        ...data,
        pages: data.pages.map((p) => ({ ...p, items: p.items.map(patch) })),
      },
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
