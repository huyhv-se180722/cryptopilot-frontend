import { useCallback } from 'react';
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useAuth } from '../../../hooks/use-auth';
import { useMutation } from '../../../hooks/use-mutation';
import { useServices } from '../../../hooks/use-services';
import type {
  AcademyArticleQuery,
  AcademyProgress,
} from '../../../types/domain';

export const ACADEMY_KEY = ['academy'] as const;

/** Twelve cards a page: four rows of three on a wide screen. */
export const ACADEMY_PAGE_SIZE = 12;

/** Lessons change rarely; a minute keeps navigation between them instant. */
const STALE_MS = 60_000;

export function useAcademyTopics() {
  const { academy } = useServices();
  return useQuery({
    queryKey: [...ACADEMY_KEY, 'topics'],
    queryFn: ({ signal }) => academy.topics(signal),
    staleTime: STALE_MS,
  });
}

/** One page of lessons; the shown page stays while the next one loads. */
export function useAcademyArticles(query: AcademyArticleQuery) {
  const { academy } = useServices();
  return useQuery({
    queryKey: [...ACADEMY_KEY, 'articles', query],
    queryFn: ({ signal }) => academy.articles(query, signal),
    placeholderData: keepPreviousData,
    staleTime: STALE_MS,
  });
}

export function useAcademyArticle(slug: string) {
  const { academy } = useServices();
  return useQuery({
    queryKey: [...ACADEMY_KEY, 'article', slug],
    queryFn: ({ signal }) => academy.article(slug, signal),
    staleTime: STALE_MS,
  });
}

/** The glossary, filtered by a search text or a first letter. */
export function useAcademyTerms(query: { q?: string; letter?: string }) {
  const { academy } = useServices();
  return useQuery({
    queryKey: [...ACADEMY_KEY, 'terms', query],
    queryFn: ({ signal }) => academy.terms(query, signal),
    placeholderData: keepPreviousData,
    staleTime: STALE_MS,
  });
}

const PROGRESS_KEY = [...ACADEMY_KEY, 'progress'] as const;

/** Only a Trader keeps a progress; a Guest and an Admin read only. */
export function useIsAcademyTrader(): boolean {
  return useAuth().session?.user.role === 'Trader';
}

/** The signed-in Trader's marked lessons; nothing is asked for anyone else. */
export function useAcademyProgress() {
  const { academy } = useServices();
  const trader = useIsAcademyTrader();
  return useQuery({
    queryKey: PROGRESS_KEY,
    enabled: trader,
    queryFn: ({ signal }) => academy.progress(signal),
  });
}

/**
 * Marks a lesson as learned, or takes the mark off. The progress is
 * updated from the answer, then read again for the path totals.
 */
export function useLessonMark() {
  const { academy } = useServices();
  const client = useQueryClient();
  return useMutation(
    useCallback(
      async (slug: string, learned: boolean) => {
        if (learned) {
          const lesson = await academy.mark(slug);
          client.setQueryData<AcademyProgress>(PROGRESS_KEY, (current) =>
            current && !current.completed.some((c) => c.slug === slug)
              ? { ...current, completed: [...current.completed, lesson] }
              : current,
          );
        } else {
          await academy.unmark(slug);
          client.setQueryData<AcademyProgress>(PROGRESS_KEY, (current) =>
            current
              ? {
                  ...current,
                  completed: current.completed.filter((c) => c.slug !== slug),
                }
              : current,
          );
        }
        await client.invalidateQueries({ queryKey: PROGRESS_KEY });
      },
      [academy, client],
    ),
  );
}
