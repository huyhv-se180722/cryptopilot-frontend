import { useCallback } from 'react';
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useMutation } from '../../../hooks/use-mutation';
import { useServices } from '../../../hooks/use-services';
import type {
  AnnouncementDraft,
  OfficialCategory,
} from '../../../types/domain';

export const ANNOUNCEMENTS_KEY = ['announcements'] as const;
const LIST_KEY = [...ANNOUNCEMENTS_KEY, 'list'] as const;
/** The community's cached feeds and pinned posts read again after a change. */
const COMMUNITY_KEY = ['community'] as const;
export const ANNOUNCEMENTS_PAGE_SIZE = 20;

/** Published and hidden announcements, newest first (UC-44). */
export function useAnnouncements(
  category: OfficialCategory | null,
  page: number,
) {
  const { announcements } = useServices();
  return useQuery({
    queryKey: [...LIST_KEY, category, page],
    queryFn: ({ signal }) =>
      announcements.list(
        {
          ...(category ? { category } : {}),
          page,
          pageSize: ANNOUNCEMENTS_PAGE_SIZE,
        },
        signal,
      ),
    placeholderData: keepPreviousData,
  });
}

/** One announcement to edit; read again on each opening of the form. */
export function useAnnouncement(id: string) {
  const { announcements } = useServices();
  return useQuery({
    queryKey: [...ANNOUNCEMENTS_KEY, 'post', id],
    queryFn: ({ signal }) => announcements.get(id, signal),
    staleTime: 0,
    gcTime: 0,
  });
}

async function refresh(client: ReturnType<typeof useQueryClient>) {
  await Promise.all([
    client.invalidateQueries({ queryKey: LIST_KEY }),
    client.invalidateQueries({ queryKey: COMMUNITY_KEY }),
  ]);
}

/** Publishes a new announcement, or edits the one named (UC-44). */
export function useSaveAnnouncement(id?: string) {
  const { announcements } = useServices();
  const client = useQueryClient();
  return useMutation(
    useCallback(
      async (draft: AnnouncementDraft) => {
        const post = id
          ? await announcements.update(id, draft)
          : await announcements.create(draft);
        await refresh(client);
        return post;
      },
      [announcements, client, id],
    ),
  );
}

/** Soft delete of an announcement (BR-47). */
export function useDeleteAnnouncement() {
  const { announcements } = useServices();
  const client = useQueryClient();
  return useMutation(
    useCallback(
      async (id: string) => {
        await announcements.remove(id);
        await refresh(client);
      },
      [announcements, client],
    ),
  );
}
