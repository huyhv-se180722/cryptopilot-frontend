import type { AcademyService } from './contracts';
import { integrationPending } from './errors';
import type { HttpClient } from './http-client';
import {
  decodeAcademyArticle,
  decodeAcademyArticlePage,
  decodeAcademyCompletedLesson,
  decodeAcademyPath,
  decodeAcademyProgress,
  decodeAcademyTerms,
  decodeAcademyTopics,
} from './academy-dto';

/** Used while no API base URL is configured. */
export function createPendingAcademyService(): AcademyService {
  return {
    topics: async () => integrationPending(),
    articles: async () => integrationPending(),
    article: async () => integrationPending(),
    path: async () => integrationPending(),
    terms: async () => integrationPending(),
    progress: async () => integrationPending(),
    mark: async () => integrationPending(),
    unmark: async () => integrationPending(),
  };
}

const noContent = () => undefined;
const withSignal = (signal?: AbortSignal) => (signal ? { signal } : {});

function query(values: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values))
    if (value !== undefined && value !== '') params.set(key, String(value));
  const text = params.toString();
  return text ? '?' + text : '';
}

/**
 * `GET /academy/**` (T-114), checked against backend
 * `feature/T-114-academy` @ 54dd618: `TopicResponse` lists,
 * `ArticleSummaryResponse` pages, `ArticleDetailResponse` and
 * `TermResponse` lists. Public: a Guest reads every one; the progress under
 * `/me/academy/progress` (@ 03e3dd4) is a Trader's.
 */
export function createHttpAcademyService(http: HttpClient): AcademyService {
  return {
    topics: (signal) =>
      http.request({
        path: 'academy/topics',
        decode: decodeAcademyTopics,
        ...withSignal(signal),
      }),
    articles: (q, signal) =>
      http.request({
        path:
          'academy/articles' +
          query({
            topic: q.topic,
            level: q.level,
            q: q.q,
            page: q.page,
            pageSize: q.pageSize,
          }),
        decode: decodeAcademyArticlePage,
        ...withSignal(signal),
      }),
    article: (slug, signal) =>
      http.request({
        path: 'academy/articles/' + encodeURIComponent(slug),
        decode: decodeAcademyArticle,
        ...withSignal(signal),
      }),
    path: (signal) =>
      http.request({
        path: 'academy/path',
        decode: decodeAcademyPath,
        ...withSignal(signal),
      }),
    terms: ({ q, letter }, signal) =>
      http.request({
        path: 'academy/terms' + query({ q, letter }),
        decode: decodeAcademyTerms,
        ...withSignal(signal),
      }),
    progress: (signal) =>
      http.request({
        path: 'me/academy/progress',
        decode: decodeAcademyProgress,
        ...withSignal(signal),
      }),
    mark: (slug) =>
      http.request({
        path: 'me/academy/progress/' + encodeURIComponent(slug),
        method: 'POST',
        decode: decodeAcademyCompletedLesson,
      }),
    unmark: (slug) =>
      http.request({
        path: 'me/academy/progress/' + encodeURIComponent(slug),
        method: 'DELETE',
        decode: noContent,
      }),
  };
}
