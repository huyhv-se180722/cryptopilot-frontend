import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useServices } from '../../../hooks/use-services';
import type { NewsQuery } from '../../../types/domain';

export const NEWS_KEY = ['news'] as const;
/** Twenty articles a page, the backend's default (CR-04). */
export const NEWS_PAGE_SIZE = 20;

export type NewsFilter = Omit<NewsQuery, 'page' | 'pageSize'>;

/**
 * One numbered page of the SCR-28 feed, newest first; the page shown stays
 * while the next one loads, so the list does not jump.
 */
export function useNewsFeed(filter: NewsFilter, page: number) {
  const { news } = useServices();
  return useQuery({
    queryKey: [...NEWS_KEY, 'feed', filter, page],
    queryFn: ({ signal }) =>
      news.feed({ ...filter, page, pageSize: NEWS_PAGE_SIZE }, signal),
    placeholderData: keepPreviousData,
  });
}

/** The newest articles of the feed, one page, for a side list. */
export function useLatestNews(limit: number) {
  const { news } = useServices();
  return useQuery({
    queryKey: [...NEWS_KEY, 'latest', null, limit],
    queryFn: ({ signal }) => news.feed({ page: 1, pageSize: limit }, signal),
  });
}

/** One article for its page in the app (D-125). */
export function useNewsArticle(id: string) {
  const { news } = useServices();
  return useQuery({
    queryKey: [...NEWS_KEY, 'article', id],
    queryFn: ({ signal }) => news.article(id, signal),
  });
}
