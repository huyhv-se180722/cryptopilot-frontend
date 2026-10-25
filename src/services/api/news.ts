import type { NewsService } from './contracts';
import { integrationPending } from './errors';
import type { HttpClient } from './http-client';
import {
  decodeNewsArticleDetail,
  decodeNewsPage,
  decodeSentimentSummary,
} from './news-dto';

/** Used while no API base URL is configured. */
export function createPendingNewsService(): NewsService {
  return {
    feed: async () => integrationPending(),
    article: async () => integrationPending(),
    sentimentSummary: async () => integrationPending(),
  };
}

const withSignal = (signal?: AbortSignal) => (signal ? { signal } : {});

/**
 * `/news`, `/news/{id}` and `/news/sentiment-summary` (UC-34, D-125),
 * checked against backend `feature/T-080c-news-article` @ 4109a68. Traders
 * only; every plan reads the same feed (D-122). A coin no coin has answers
 * an empty page; a hidden article answers 404.
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
    article: (id, signal) =>
      http.request({
        path: 'news/' + encodeURIComponent(id),
        decode: decodeNewsArticleDetail,
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
