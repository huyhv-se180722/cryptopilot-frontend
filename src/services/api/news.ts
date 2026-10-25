import type { NewsService } from './contracts';
import { integrationPending } from './errors';
import type { HttpClient } from './http-client';
import { decodeNewsPage, decodeSentimentSummary } from './news-dto';

/** Used while no API base URL is configured. */
export function createPendingNewsService(): NewsService {
  return {
    feed: async () => integrationPending(),
    sentimentSummary: async () => integrationPending(),
  };
}

const withSignal = (signal?: AbortSignal) => (signal ? { signal } : {});

/**
 * `/news` and `/news/sentiment-summary` (UC-34), checked against backend
 * `feature/T-080-news-api` @ cdfefd7. Traders only; every plan reads the
 * same feed (D-122). A coin no coin has answers an empty page.
 */
export function createHttpNewsService(http: HttpClient): NewsService {
  return {
    feed: ({ coin, sentiment, range, page, pageSize }, signal) =>
      http.request({
        path:
          'news?' +
          new URLSearchParams({
            ...(coin ? { coin } : {}),
            ...(sentiment ? { sentiment } : {}),
            ...(range ? { range } : {}),
            page: String(page),
            pageSize: String(pageSize),
          }).toString(),
        decode: decodeNewsPage,
        ...withSignal(signal),
      }),
    sentimentSummary: (signal) =>
      http.request({
        path: 'news/sentiment-summary',
        decode: decodeSentimentSummary,
        ...withSignal(signal),
      }),
  };
}
