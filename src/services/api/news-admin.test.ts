import { describe, expect, it, vi } from 'vitest';
import { createHttpClient } from './http-client';
import {
  createHttpNewsAdminService,
  createPendingNewsAdminService,
} from './news-admin';

/** Shapes of backend `feature/T-080b-news-admin` @ 43ff01a. */
const SOURCE = {
  sourceId: '019b76da-a800-7d01-8000-0000000000s1',
  sourceName: 'CoinDesk Markets',
  feedUrl: 'https://feeds.example.test/markets',
  sourceType: 'RSS',
  crawlIntervalMinutes: 30,
  active: true,
  categoryFilter: null,
  bodySelector: 'main article',
  excludedSelectors: null,
  userAgent: null,
  lastCrawledAt: '2026-10-25T10:00:00Z',
  lastCrawl: {
    startedAt: '2026-10-25T10:00:00Z',
    status: 'PARTIAL',
    articlesFound: 12,
    articlesInserted: 4,
  },
  nextCrawlAt: '2026-10-25T10:30:00Z',
  createdAt: '2026-10-20T08:00:00Z',
  updatedAt: '2026-10-25T10:00:00Z',
};
const LOG = {
  crawlLogId: 'log-1',
  startedAt: '2026-10-25T10:00:00Z',
  finishedAt: '2026-10-25T10:00:03Z',
  status: 'SUCCESS',
  articlesFound: 3,
  articlesInserted: 1,
  errorMessage: null,
};
const ARTICLE = {
  articleId: 'art-1',
  sourceId: SOURCE.sourceId,
  source: 'CoinDesk Markets',
  title: 'Bitcoin holds $81K',
  aiTitle: 'Bitcoin giữ mức $81K',
  originalUrl: 'https://news.example.test/1',
  excerpt: 'Bitcoin traded flat.',
  aiSummary: 'Bitcoin đi ngang.',
  sentiment: 'NEUTRAL',
  publishedAt: '2026-10-25T09:00:00Z',
  collectedAt: '2026-10-25T09:05:00Z',
  status: 'SUMMARIZED',
  summaryAttempts: 1,
  summaryError: null,
  summaryAttemptedAt: '2026-10-25T09:10:00Z',
  hiddenAt: null,
};

function setup(reply: unknown, status = 200) {
  const calls: { url: URL; method: string; body: unknown }[] = [];
  const http = createHttpClient({
    baseUrl: 'https://api.example.test/api/v1',
    fetcher: vi.fn<typeof fetch>(async (input, init = {}) => {
      calls.push({
        url: new URL(String(input)),
        method: init.method ?? 'GET',
        body: init.body ? JSON.parse(String(init.body)) : undefined,
      });
      return status === 204
        ? new Response(null, { status })
        : new Response(JSON.stringify(reply), { status });
    }),
    session: { accessToken: () => 'admin', refresh: async () => 'renewed' },
  });
  return { service: createHttpNewsAdminService(http), calls };
}

describe('news admin service (UC-49, T-080b)', () => {
  it('lists the sources with their last and next crawl', async () => {
    const { service, calls } = setup([SOURCE]);

    const [source] = await service.sources();

    expect(calls[0]?.url.pathname).toBe('/api/v1/admin/news-sources');
    expect(source).toMatchObject({
      id: SOURCE.sourceId,
      sourceName: 'CoinDesk Markets',
      crawlIntervalMinutes: 30,
      active: true,
      bodySelector: 'main article',
      lastCrawledAt: '2026-10-25T10:00:00Z',
      lastCrawl: { status: 'PARTIAL', articlesFound: 12, articlesInserted: 4 },
      nextCrawlAt: '2026-10-25T10:30:00Z',
    });
  });

  it('sends a draft as NewsSourceRequest, posting a new one and putting an edit', async () => {
    const { service, calls } = setup(SOURCE);
    const draft = {
      sourceName: 'CoinDesk Markets',
      feedUrl: 'https://feeds.example.test/markets',
      crawlIntervalMinutes: 30,
      active: true,
      categoryFilter: null,
      bodySelector: 'main article',
      excludedSelectors: null,
      userAgent: null,
    };

    await service.createSource(draft);
    await service.updateSource('s/1', draft);

    expect(calls[0]).toMatchObject({ method: 'POST', body: draft });
    expect(calls[1]?.method).toBe('PUT');
    expect(calls[1]?.url.pathname).toBe('/api/v1/admin/news-sources/s%2F1');
  });

  it('crawls now, reads a page of the crawl log, and deletes', async () => {
    const crawl = setup(LOG);
    expect(await crawl.service.crawlNow('s1')).toMatchObject({
      status: 'SUCCESS',
      articlesInserted: 1,
    });
    expect(crawl.calls[0]).toMatchObject({ method: 'POST' });
    expect(crawl.calls[0]?.url.pathname).toBe(
      '/api/v1/admin/news-sources/s1/crawl',
    );

    const logs = setup({ items: [LOG], page: 2, pageSize: 10, total: 11 });
    const page = await logs.service.crawlLogs('s1', 2, 10);
    expect(page.total).toBe(11);
    expect(Object.fromEntries(logs.calls[0]?.url.searchParams ?? [])).toEqual({
      page: '2',
      pageSize: '10',
    });

    const removal = setup(null, 204);
    await removal.service.deleteSource('s1');
    expect(removal.calls[0]?.method).toBe('DELETE');
  });

  it('keeps the seconds of a refused crawl in the problem', async () => {
    const { service } = setup(
      {
        code: 'NEWS_SOURCE_CRAWLED_RECENTLY',
        messageCode: 'MSG50',
        messageArgs: ['42'],
      },
      429,
    );

    await expect(service.crawlNow('s1')).rejects.toMatchObject({
      status: 429,
      problem: { code: 'NEWS_SOURCE_CRAWLED_RECENTLY', messageArgs: ['42'] },
    });
  });

  it('asks for articles with only the filters named, and acts on one', async () => {
    const list = setup({ items: [ARTICLE], page: 1, pageSize: 20, total: 1 });
    const page = await list.service.articles({
      status: 'FAILED',
      sourceId: 's1',
      page: 1,
      pageSize: 20,
    });
    expect(page.items[0]).toMatchObject({
      id: 'art-1',
      aiTitle: 'Bitcoin giữ mức $81K',
      status: 'SUMMARIZED',
      summaryAttempts: 1,
    });
    expect(Object.fromEntries(list.calls[0]?.url.searchParams ?? [])).toEqual({
      status: 'FAILED',
      sourceId: 's1',
      page: '1',
      pageSize: '20',
    });

    const action = setup({ ...ARTICLE, status: 'HIDDEN' });
    await action.service.hide('art-1');
    await action.service.restore('art-1');
    await action.service.summarize('art-1');
    expect(action.calls.map((c) => c.method + ' ' + c.url.pathname)).toEqual([
      'POST /api/v1/admin/news-articles/art-1/hide',
      'POST /api/v1/admin/news-articles/art-1/restore',
      'POST /api/v1/admin/news-articles/art-1/summarize',
    ]);
  });

  it('refuses an unsafe article address or an unknown status', async () => {
    for (const bad of [
      { ...ARTICLE, originalUrl: 'javascript:alert(1)' },
      { ...ARTICLE, status: 'STUCK' },
      { ...ARTICLE, summaryAttempts: -1 },
    ]) {
      const { service } = setup({
        items: [bad],
        page: 1,
        pageSize: 20,
        total: 1,
      });
      await expect(
        service.articles({ page: 1, pageSize: 20 }),
      ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    }
  });

  it('reads the 24-hour count per sentiment and refuses a negative count (D-126)', async () => {
    const summary = {
      since: '2026-10-24T10:00:00Z',
      bullish: 4,
      neutral: 0,
      bearish: 2,
    };
    const { service, calls } = setup(summary);

    expect(await service.sentimentSummary()).toEqual(summary);
    expect(calls[0]?.url.pathname).toBe(
      '/api/v1/admin/news-articles/sentiment-summary',
    );

    const broken = setup({ ...summary, bearish: -1 });
    await expect(broken.service.sentimentSummary()).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    });
  });

  it('is pending without an API', async () => {
    const pending = createPendingNewsAdminService();
    await expect(pending.sources()).rejects.toMatchObject({
      code: 'NOT_CONFIGURED',
    });
    await expect(pending.crawlNow('s1')).rejects.toMatchObject({
      code: 'NOT_CONFIGURED',
    });
  });
});
