import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useServices } from '../../../hooks/use-services';
import type { AcademyArticleQuery } from '../../../types/domain';

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

/** The beginner path, in order. */
export function useAcademyPath() {
  const { academy } = useServices();
  return useQuery({
    queryKey: [...ACADEMY_KEY, 'path'],
    queryFn: ({ signal }) => academy.path(signal),
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
