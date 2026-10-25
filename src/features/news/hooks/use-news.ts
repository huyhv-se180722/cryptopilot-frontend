import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useServices } from '../../../hooks/use-services';
import type { NewsQuery } from '../../../types/domain';

export const NEWS_KEY = ['news'] as const;
/** Twenty articles a page, the backend's default (CR-04). */
export const NEWS_PAGE_SIZE = 20;

export type NewsFilter = Omit<NewsQuery, 'page' | 'pageSize'>;

const nextPage = (last: { page: number; pageSize: number; total: number }) =>
  last.page * last.pageSize < last.total ? last.page + 1 : undefined;

/** The SCR-28 feed, newest first, a page at a time. */
export function useNewsFeed(filter: NewsFilter) {
  const { news } = useServices();
  return useInfiniteQuery({
    queryKey: [...NEWS_KEY, 'feed', filter],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      news.feed(
        { ...filter, page: pageParam, pageSize: NEWS_PAGE_SIZE },
        signal,
      ),
    getNextPageParam: nextPage,
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

/** The 24-hour count per sentiment of the summary bar (SRS 3.8.1). */
export function useSentimentSummary() {
  const { news } = useServices();
  return useQuery({
    queryKey: [...NEWS_KEY, 'sentiment-summary'],
    queryFn: ({ signal }) => news.sentimentSummary(signal),
  });
}
