import type {
  NewsArticle,
  NewsArticleDetail,
  NewsCoinTag,
  NewsPage,
  NewsSentiment,
  NewsSentimentSummary,
} from '../../types/domain';
import {
  flag,
  instant,
  integer,
  list,
  nullableText,
  oneOf,
  record,
  text,
} from './decode';

/**
 * Decoders for `/news`, `/news/{id}` and `/news/sentiment-summary` (UC-34,
 * D-122, D-123, D-125), checked against backend
 * `feature/T-080c-news-article` @ 4109a68: `PageResponse<NewsArticleResponse>`,
 * `NewsArticleDetailResponse` and `NewsSentimentSummaryResponse`.
 */
export const NEWS_SENTIMENTS: readonly NewsSentiment[] = [
  'BULLISH',
  'NEUTRAL',
  'BEARISH',
];

function count(value: unknown, name: string): number {
  const n = integer(value, name);
  if (n < 0) throw new Error(name + ' must not be negative');
  return n;
}

/**
 * The article's address, http(s) only: it becomes a link, and a feed is
 * outside data, so `javascript:` or any other scheme never reaches an href.
 */
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

/** An image address from outside data: kept only when it is http(s), else the placeholder is shown. */
function imageAddress(value: unknown, name: string): string | null {
  if (value === null || value === undefined) return null;
  try {
    return webAddress(value, name);
  } catch {
    return null;
  }
}

function decodeCoin(body: unknown): NewsCoinTag {
  const value = record(body, 'coin');
  return {
    symbol: text(value.symbol, 'coin.symbol'),
    primary: flag(value.primary, 'coin.primary'),
  };
}

export function decodeNewsArticle(body: unknown): NewsArticle {
  const value = record(body, 'article');
  return {
    id: text(value.articleId, 'articleId'),
    title: text(value.title, 'title'),
    originalTitle: text(value.originalTitle, 'originalTitle'),
    source: text(value.source, 'source'),
    originalUrl: webAddress(value.originalUrl, 'originalUrl'),
    publishedAt: instant(value.publishedAt, 'publishedAt'),
    summary: nullableText(value.summary, 'summary'),
    aiSummarized: flag(value.aiSummarized, 'aiSummarized'),
    sentiment:
      value.sentiment === null || value.sentiment === undefined
        ? null
        : oneOf(NEWS_SENTIMENTS, value.sentiment, 'sentiment'),
    coins: list(value.coins ?? [], 'coins').map(decodeCoin),
    imageUrl: imageAddress(value.imageUrl, 'imageUrl'),
  };
}

export function decodeNewsArticleDetail(body: unknown): NewsArticleDetail {
  const value = record(body, 'article');
  return {
    ...decodeNewsArticle(body),
    body: nullableText(value.body, 'body'),
  };
}

export function decodeNewsPage(body: unknown): NewsPage {
  const value = record(body, 'page');
  return {
    items: list(value.items, 'items').map(decodeNewsArticle),
    page: integer(value.page, 'page'),
    pageSize: integer(value.pageSize, 'pageSize'),
    total: count(value.total, 'total'),
  };
}

export function decodeSentimentSummary(body: unknown): NewsSentimentSummary {
  const value = record(body, 'summary');
  return {
    since: instant(value.since, 'since'),
    bullish: count(value.bullish, 'bullish'),
    neutral: count(value.neutral, 'neutral'),
    bearish: count(value.bearish, 'bearish'),
  };
}
