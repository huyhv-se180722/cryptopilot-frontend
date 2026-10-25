import type {
  AdminNewsArticle,
  AdminNewsArticlePage,
  CrawlStatus,
  NewsArticleStatus,
  NewsCrawlLog,
  NewsCrawlLogPage,
  NewsSentimentCounts,
  NewsSource,
  NewsSourceDraft,
} from '../../types/domain';
import {
  flag,
  instant,
  integer,
  list,
  nullableInstant,
  nullableText,
  oneOf,
  record,
  text,
} from './decode';

/**
 * Decoders for `/admin/news-sources/**` and `/admin/news-articles/**`
 * (UC-49, T-080b, D-124), checked against backend
 * `feature/T-080b-news-admin` @ 43ff01a: `NewsSourceResponse`,
 * `NewsCrawlLogResponse`, `AdminNewsArticleResponse`, `NewsSourceRequest`.
 */
const CRAWL_STATUSES: readonly CrawlStatus[] = ['SUCCESS', 'PARTIAL', 'FAILED'];
const ARTICLE_STATUSES: readonly NewsArticleStatus[] = [
  'PENDING',
  'FAILED',
  'SUMMARIZED',
  'HIDDEN',
];
const SENTIMENTS = ['BULLISH', 'NEUTRAL', 'BEARISH'] as const;

function count(value: unknown, name: string): number {
  const n = integer(value, name);
  if (n < 0) throw new Error(name + ' must not be negative');
  return n;
}
function nullableCount(value: unknown, name: string): number | null {
  return value === null || value === undefined ? null : count(value, name);
}
/** An address that becomes a link: http(s) only, never another scheme. */
function webAddress(value: unknown, name: string): string {
  const raw = text(value, name);
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(name + ' must be an absolute address');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:')
    throw new Error(name + ' must be an http(s) address');
  return url.href;
}

export function decodeNewsSource(body: unknown): NewsSource {
  const value = record(body, 'source');
  const last =
    value.lastCrawl === null || value.lastCrawl === undefined
      ? null
      : record(value.lastCrawl, 'lastCrawl');
  return {
    id: text(value.sourceId, 'sourceId'),
    sourceName: text(value.sourceName, 'sourceName'),
    feedUrl: webAddress(value.feedUrl, 'feedUrl'),
    crawlIntervalMinutes: count(
      value.crawlIntervalMinutes,
      'crawlIntervalMinutes',
    ),
    active: flag(value.active, 'active'),
    categoryFilter: nullableText(value.categoryFilter, 'categoryFilter'),
    bodySelector: nullableText(value.bodySelector, 'bodySelector'),
    excludedSelectors: nullableText(
      value.excludedSelectors,
      'excludedSelectors',
    ),
    userAgent: nullableText(value.userAgent, 'userAgent'),
    lastCrawledAt: nullableInstant(value.lastCrawledAt, 'lastCrawledAt'),
    lastCrawl: last && {
      startedAt: instant(last.startedAt, 'lastCrawl.startedAt'),
      status: oneOf(CRAWL_STATUSES, last.status, 'lastCrawl.status'),
      articlesFound: nullableCount(
        last.articlesFound,
        'lastCrawl.articlesFound',
      ),
      articlesInserted: nullableCount(
        last.articlesInserted,
        'lastCrawl.articlesInserted',
      ),
    },
    nextCrawlAt: nullableInstant(value.nextCrawlAt, 'nextCrawlAt'),
  };
}

export function decodeNewsSources(body: unknown): readonly NewsSource[] {
  return list(body, 'sources').map(decodeNewsSource);
}

export function decodeCrawlLog(body: unknown): NewsCrawlLog {
  const value = record(body, 'crawlLog');
  return {
    id: text(value.crawlLogId, 'crawlLogId'),
    startedAt: instant(value.startedAt, 'startedAt'),
    finishedAt: nullableInstant(value.finishedAt, 'finishedAt'),
    status: oneOf(CRAWL_STATUSES, value.status, 'status'),
    articlesFound: nullableCount(value.articlesFound, 'articlesFound'),
    articlesInserted: nullableCount(value.articlesInserted, 'articlesInserted'),
    errorMessage: nullableText(value.errorMessage, 'errorMessage'),
  };
}

export function decodeCrawlLogPage(body: unknown): NewsCrawlLogPage {
  const value = record(body, 'page');
  return {
    items: list(value.items, 'items').map(decodeCrawlLog),
    page: integer(value.page, 'page'),
    pageSize: integer(value.pageSize, 'pageSize'),
    total: count(value.total, 'total'),
  };
}

export function decodeAdminArticle(body: unknown): AdminNewsArticle {
  const value = record(body, 'article');
  return {
    id: text(value.articleId, 'articleId'),
    sourceId: text(value.sourceId, 'sourceId'),
    source: text(value.source, 'source'),
    title: text(value.title, 'title'),
    aiTitle: nullableText(value.aiTitle, 'aiTitle'),
    originalUrl: webAddress(value.originalUrl, 'originalUrl'),
    excerpt: nullableText(value.excerpt, 'excerpt'),
    aiSummary: nullableText(value.aiSummary, 'aiSummary'),
    sentiment:
      value.sentiment === null || value.sentiment === undefined
        ? null
        : oneOf(SENTIMENTS, value.sentiment, 'sentiment'),
    publishedAt: instant(value.publishedAt, 'publishedAt'),
    collectedAt: instant(value.collectedAt, 'collectedAt'),
    status: oneOf(ARTICLE_STATUSES, value.status, 'status'),
    summaryAttempts: count(value.summaryAttempts, 'summaryAttempts'),
    summaryError: nullableText(value.summaryError, 'summaryError'),
    summaryAttemptedAt: nullableInstant(
      value.summaryAttemptedAt,
      'summaryAttemptedAt',
    ),
    hiddenAt: nullableInstant(value.hiddenAt, 'hiddenAt'),
  };
}

export function decodeAdminArticlePage(body: unknown): AdminNewsArticlePage {
  const value = record(body, 'page');
  return {
    items: list(value.items, 'items').map(decodeAdminArticle),
    page: integer(value.page, 'page'),
    pageSize: integer(value.pageSize, 'pageSize'),
    total: count(value.total, 'total'),
  };
}

/** `NewsSourceRequest`; the backend reads a blank optional value as none. */
export function encodeSourceDraft(draft: NewsSourceDraft) {
  return {
    sourceName: draft.sourceName,
    feedUrl: draft.feedUrl,
    crawlIntervalMinutes: draft.crawlIntervalMinutes,
    active: draft.active,
    categoryFilter: draft.categoryFilter,
    bodySelector: draft.bodySelector,
    excludedSelectors: draft.excludedSelectors,
    userAgent: draft.userAgent,
  };
}

/** `GET /admin/news-articles/sentiment-summary` (D-126). */
export function decodeSentimentCounts(body: unknown): NewsSentimentCounts {
  const value = record(body, 'summary');
  return {
    since: instant(value.since, 'since'),
    bullish: count(value.bullish, 'bullish'),
    neutral: count(value.neutral, 'neutral'),
    bearish: count(value.bearish, 'bearish'),
  };
}
