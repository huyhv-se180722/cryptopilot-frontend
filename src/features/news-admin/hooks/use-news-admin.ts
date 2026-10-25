import { useCallback } from 'react';
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { useMutation } from '../../../hooks/use-mutation';
import { useServices } from '../../../hooks/use-services';
import type { NewsArticleStatus, NewsSourceDraft } from '../../../types/domain';

export const NEWS_ADMIN_KEY = ['news-admin'] as const;
const SOURCES_KEY = [...NEWS_ADMIN_KEY, 'sources'] as const;
const LOGS_KEY = [...NEWS_ADMIN_KEY, 'logs'] as const;
const ARTICLES_KEY = [...NEWS_ADMIN_KEY, 'articles'] as const;
/** The Traders' feed caches, read again after an article is hidden or shown. */
const FEED_KEY = ['news'] as const;
export const ARTICLES_PAGE_SIZE = 20;
export const LOGS_PAGE_SIZE = 10;

/** Every source with its last crawl and next due time (SCR-41). */
export function useNewsSources() {
  const { newsAdmin } = useServices();
  return useQuery({
    queryKey: SOURCES_KEY,
    queryFn: ({ signal }) => newsAdmin.sources(signal),
  });
}

/** One page of a source's crawl log, latest first; read while it is open. */
export function useCrawlLogs(sourceId: string | null, page: number) {
  const { newsAdmin } = useServices();
  return useQuery({
    queryKey: [...LOGS_KEY, sourceId, page],
    enabled: sourceId !== null,
    queryFn: ({ signal }) =>
      newsAdmin.crawlLogs(sourceId ?? '', page, LOGS_PAGE_SIZE, signal),
    placeholderData: keepPreviousData,
  });
}

async function refreshSources(client: QueryClient) {
  await Promise.all([
    client.invalidateQueries({ queryKey: SOURCES_KEY }),
    client.invalidateQueries({ queryKey: LOGS_KEY }),
  ]);
}

/** Adds a source, or replaces every setting of the one named (UC-49). */
export function useSaveSource(sourceId: string | null) {
  const { newsAdmin } = useServices();
  const client = useQueryClient();
  return useMutation(
    useCallback(
      async (draft: NewsSourceDraft) => {
        const source = sourceId
          ? await newsAdmin.updateSource(sourceId, draft)
          : await newsAdmin.createSource(draft);
        await refreshSources(client);
        return source;
      },
      [newsAdmin, client, sourceId],
    ),
  );
}

export function useDeleteSource() {
  const { newsAdmin } = useServices();
  const client = useQueryClient();
  return useMutation(
    useCallback(
      async (sourceId: string) => {
        await newsAdmin.deleteSource(sourceId);
        await refreshSources(client);
      },
      [newsAdmin, client],
    ),
  );
}

/** Crawls a source now; its schedule restarts from now (T-080b). */
export function useCrawlNow() {
  const { newsAdmin } = useServices();
  const client = useQueryClient();
  return useMutation(
    useCallback(
      async (sourceId: string) => {
        const log = await newsAdmin.crawlNow(sourceId);
        await Promise.all([
          refreshSources(client),
          client.invalidateQueries({ queryKey: ARTICLES_KEY }),
        ]);
        return log;
      },
      [newsAdmin, client],
    ),
  );
}

/** The collected articles, newest first, hidden ones included (D-124). */
/**
 * The 24-hour count per sentiment (D-126); under the articles' key, so
 * hiding, showing or summarizing an article refreshes it.
 */
export function useSentimentCounts() {
  const { newsAdmin } = useServices();
  return useQuery({
    queryKey: [...ARTICLES_KEY, 'sentiment-summary'],
    queryFn: ({ signal }) => newsAdmin.sentimentSummary(signal),
  });
}

export function useAdminArticles(
  status: NewsArticleStatus | null,
  sourceId: string | null,
  page: number,
) {
  const { newsAdmin } = useServices();
  return useQuery({
    queryKey: [...ARTICLES_KEY, status, sourceId, page],
    queryFn: ({ signal }) =>
      newsAdmin.articles(
        {
          ...(status ? { status } : {}),
          ...(sourceId ? { sourceId } : {}),
          page,
          pageSize: ARTICLES_PAGE_SIZE,
        },
        signal,
      ),
    placeholderData: keepPreviousData,
  });
}

async function refreshArticles(client: QueryClient) {
  await Promise.all([
    client.invalidateQueries({ queryKey: ARTICLES_KEY }),
    client.invalidateQueries({ queryKey: FEED_KEY }),
  ]);
}

export type ArticleAction = 'hide' | 'restore' | 'summarize';

/** Hides, shows again or summarizes again one article (T-080b). */
export function useArticleAction() {
  const { newsAdmin } = useServices();
  const client = useQueryClient();
  return useMutation(
    useCallback(
      async (action: ArticleAction, articleId: string) => {
        const article = await newsAdmin[action](articleId);
        await refreshArticles(client);
        return article;
      },
      [newsAdmin, client],
    ),
  );
}
