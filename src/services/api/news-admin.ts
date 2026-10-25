import type { NewsAdminService } from './contracts';
import { integrationPending } from './errors';
import type { HttpClient } from './http-client';
import {
  decodeAdminArticle,
  decodeAdminArticlePage,
  decodeCrawlLog,
  decodeCrawlLogPage,
  decodeNewsSource,
  decodeNewsSources,
  decodeSentimentCounts,
  encodeSourceDraft,
} from './news-admin-dto';

/** Used while no API base URL is configured. */
export function createPendingNewsAdminService(): NewsAdminService {
  return {
    sources: async () => integrationPending(),
    createSource: async () => integrationPending(),
    updateSource: async () => integrationPending(),
    deleteSource: async () => integrationPending(),
    crawlLogs: async () => integrationPending(),
    crawlNow: async () => integrationPending(),
    articles: async () => integrationPending(),
    hide: async () => integrationPending(),
    restore: async () => integrationPending(),
    summarize: async () => integrationPending(),
    sentimentSummary: async () => integrationPending(),
  };
}

const id = (value: string) => encodeURIComponent(value);
const noContent = () => undefined;
const withSignal = (signal?: AbortSignal) => (signal ? { signal } : {});
const SOURCES = 'admin/news-sources';
const ARTICLES = 'admin/news-articles';
/** A feed is read within 30 seconds (NSF-10), with room for storing it. */
const CRAWL_TIMEOUT_MS = 60_000;
/** The backend waits up to 130 seconds for the AI Service. */
const SUMMARIZE_TIMEOUT_MS = 140_000;

/**
 * `/admin/news-sources/**` (UC-49, T-080b) and `/admin/news-articles/**`
 * (T-080b, D-124), checked against backend `feature/T-080b-news-admin`
 * @ 43ff01a. Admin only. A summary request waits for the model, so it gets
 * a longer timeout than the client's default.
 */
export function createHttpNewsAdminService(http: HttpClient): NewsAdminService {
  return {
    sources: (signal) =>
      http.request({
        path: SOURCES,
        decode: decodeNewsSources,
        ...withSignal(signal),
      }),
    createSource: (draft) =>
      http.request({
        path: SOURCES,
        method: 'POST',
        body: encodeSourceDraft(draft),
        decode: decodeNewsSource,
      }),
    updateSource: (sourceId, draft) =>
      http.request({
        path: SOURCES + '/' + id(sourceId),
        method: 'PUT',
        body: encodeSourceDraft(draft),
        decode: decodeNewsSource,
      }),
    deleteSource: (sourceId) =>
      http.request({
        path: SOURCES + '/' + id(sourceId),
        method: 'DELETE',
        decode: noContent,
      }),
    crawlLogs: (sourceId, page, pageSize, signal) =>
      http.request({
        path:
          SOURCES +
          '/' +
          id(sourceId) +
          '/crawl-logs?' +
          new URLSearchParams({
            page: String(page),
            pageSize: String(pageSize),
          }).toString(),
        decode: decodeCrawlLogPage,
        ...withSignal(signal),
      }),
    crawlNow: (sourceId) =>
      http.request({
        path: SOURCES + '/' + id(sourceId) + '/crawl',
        method: 'POST',
        decode: decodeCrawlLog,
        timeoutMs: CRAWL_TIMEOUT_MS,
      }),
    articles: ({ status, sourceId, page, pageSize }, signal) =>
      http.request({
        path:
          ARTICLES +
          '?' +
          new URLSearchParams({
            ...(status ? { status } : {}),
            ...(sourceId ? { sourceId } : {}),
            page: String(page),
            pageSize: String(pageSize),
          }).toString(),
        decode: decodeAdminArticlePage,
        ...withSignal(signal),
      }),
    hide: (articleId) =>
      http.request({
        path: ARTICLES + '/' + id(articleId) + '/hide',
        method: 'POST',
        decode: decodeAdminArticle,
      }),
    restore: (articleId) =>
      http.request({
        path: ARTICLES + '/' + id(articleId) + '/restore',
        method: 'POST',
        decode: decodeAdminArticle,
      }),
    summarize: (articleId) =>
      http.request({
        path: ARTICLES + '/' + id(articleId) + '/summarize',
        method: 'POST',
        decode: decodeAdminArticle,
        timeoutMs: SUMMARIZE_TIMEOUT_MS,
      }),
    sentimentSummary: (signal) =>
      http.request({
        path: ARTICLES + '/sentiment-summary',
        decode: decodeSentimentCounts,
        ...withSignal(signal),
      }),
  };
}
