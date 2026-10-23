import { useCallback } from 'react';
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useMutation } from '../../../hooks/use-mutation';
import { useServices } from '../../../hooks/use-services';
import type { ModerationAction } from '../../../types/domain';

export const MODERATION_KEY = ['moderation'] as const;
const QUEUE_KEY = [...MODERATION_KEY, 'queue'] as const;
/** The community's cached feeds and posts read again after a decision. */
const COMMUNITY_KEY = ['community'] as const;
export const QUEUE_PAGE_SIZE = 20;

/** SCR-36: posts with open reports, reported longest ago first. */
export function useModerationQueue(page: number) {
  const { moderation } = useServices();
  return useQuery({
    queryKey: [...QUEUE_KEY, page],
    queryFn: ({ signal }) => moderation.queue(page, QUEUE_PAGE_SIZE, signal),
    placeholderData: keepPreviousData,
  });
}

/**
 * Opens a reported post with its reports, which the backend marks
 * REVIEWING: read once per opening, never again in the background. The
 * call is never aborted: the server has claimed the reports anyway, and a
 * second opening at the same moment loses its optimistic lock (409).
 */
export function useModerationCase(postId: string | null) {
  const { moderation } = useServices();
  return useQuery({
    queryKey: [...MODERATION_KEY, 'case', postId],
    enabled: postId !== null,
    queryFn: () => moderation.open(postId ?? ''),
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
    retry: false,
  });
}

/**
 * One decision for all open reports of a post (UC-43). The queue and the
 * community's views read again; nothing changes before the server answers.
 */
export function useModerationDecision() {
  const { moderation } = useServices();
  const client = useQueryClient();
  return useMutation(
    useCallback(
      async (postId: string, action: ModerationAction, note: string | null) => {
        const result = await moderation.decide(postId, action, note);
        await Promise.all([
          client.invalidateQueries({ queryKey: QUEUE_KEY }),
          client.invalidateQueries({ queryKey: COMMUNITY_KEY }),
        ]);
        return result;
      },
      [moderation, client],
    ),
  );
}

/** Shows a hidden post again (UC-43). */
export function useRestorePost() {
  const { moderation } = useServices();
  const client = useQueryClient();
  return useMutation(
    useCallback(
      async (postId: string) => {
        const post = await moderation.restore(postId);
        await Promise.all([
          client.invalidateQueries({ queryKey: MODERATION_KEY }),
          client.invalidateQueries({ queryKey: COMMUNITY_KEY }),
        ]);
        return post;
      },
      [moderation, client],
    ),
  );
}
