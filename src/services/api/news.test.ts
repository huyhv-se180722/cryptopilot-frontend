import { describe, expect, it, vi } from 'vitest';
import { createHttpClient } from './http-client';
import { createHttpNewsService, createPendingNewsService } from './news';

/** Shapes of backend `feature/T-080c-news-article` @ 4109a68 (`NewsArticleResponse`). */
const ARTICLE = {
  articleId: '019b76da-a800-7d01-8000-0000000000a1',
  title: 'ETF Bitcoin bị rút $635 triệu',
  originalTitle: 'Bitcoin ETFs see $635M outflows',
  source: 'Desk',
  originalUrl: 'https://news.example.test/a1',
  publishedAt: '2026-10-25T09:50:00Z',
  summary: 'Quỹ ETF Bitcoin bị rút ròng $635 triệu.',
  aiSummarized: true,
  sentiment: 'BEARISH',
  coins: [
    { symbol: 'BTC', primary: true },
    { symbol: 'ETH', primary: false },
  ],
  imageUrl: 'https://img.example.test/a1.jpg',
};
const PAGE = { items: [ARTICLE], page: 1, pageSize: 20, total: 1 };

function setup(reply: unknown, status = 200) {
  const calls: URL[] = [];
  const http = createHttpClient({
    baseUrl: 'https://api.example.test/api/v1',
    fetcher: vi.fn<typeof fetch>(async (input) => {
      calls.push(new URL(String(input)));
      return new Response(JSON.stringify(reply), { status });
    }),
    session: { accessToken: () => 'trader', refresh: async () => 'renewed' },
  });
  return { service: createHttpNewsService(http), calls };
}

describe('news service (UC-34)', () => {
  it('asks for the feed with only the filters named and decodes the items', async () => {
    const { service, calls } = setup(PAGE);

    const page = await service.feed({
      coin: 'BTC',
      sentiment: 'BEARISH',
      range: '24h',
      page: 2,
      pageSize: 20,
    });
    await service.feed({ page: 1, pageSize: 5 });

    expect(calls[0]?.pathname).toBe('/api/v1/news');
    expect(Object.fromEntries(calls[0]?.searchParams ?? [])).toEqual({
      coin: 'BTC',
      sentiment: 'BEARISH',
      range: '24h',
      page: '2',
      pageSize: '20',
    });
    expect(Object.fromEntries(calls[1]?.searchParams ?? [])).toEqual({
      page: '1',
      pageSize: '5',
    });
    expect(page.items[0]).toEqual({
      id: ARTICLE.articleId,
      title: ARTICLE.title,
      originalTitle: ARTICLE.originalTitle,
      source: 'Desk',
      originalUrl: 'https://news.example.test/a1',
      publishedAt: ARTICLE.publishedAt,
      summary: ARTICLE.summary,
      aiSummarized: true,
      sentiment: 'BEARISH',
      coins: ARTICLE.coins,
      imageUrl: 'https://img.example.test/a1.jpg',
    });
  });

  it('reads one article for its page, with the body the AI wrote (D-125)', async () => {
    const { service, calls } = setup({
      ...ARTICLE,
      body: 'Đoạn một.\n\nĐoạn hai.',
    });

    const article = await service.article(ARTICLE.articleId);

    expect(calls[0]?.pathname).toBe('/api/v1/news/' + ARTICLE.articleId);
    expect(article).toMatchObject({
      id: ARTICLE.articleId,
      body: 'Đoạn một.\n\nĐoạn hai.',
      imageUrl: 'https://img.example.test/a1.jpg',
    });
    const { service: bare } = setup({ ...ARTICLE, body: null, imageUrl: null });
    expect(await bare.article('x')).toMatchObject({
      body: null,
      imageUrl: null,
    });
  });

  it('drops an image address that is not http(s), so the placeholder shows', async () => {
    const { service } = setup({
      ...PAGE,
      items: [{ ...ARTICLE, imageUrl: 'javascript:alert(1)' }],
    });

    const [article] = (await service.feed({ page: 1, pageSize: 20 })).items;

    expect(article?.imageUrl).toBeNull();
  });

  it('reads an unsummarized article without sentiment, summary or coins', async () => {
    const { service } = setup({
      ...PAGE,
      items: [
        {
          ...ARTICLE,
          title: ARTICLE.originalTitle,
          summary: null,
          aiSummarized: false,
          sentiment: null,
          coins: [],
        },
      ],
    });

    const [article] = (await service.feed({ page: 1, pageSize: 20 })).items;

    expect(article).toMatchObject({
      summary: null,
      aiSummarized: false,
      sentiment: null,
      coins: [],
    });
  });

  it('refuses an article whose address is not http(s), or an unknown sentiment', async () => {
    for (const bad of [
      { ...ARTICLE, originalUrl: 'javascript:alert(1)' },
      { ...ARTICLE, originalUrl: '/relative/path' },
      { ...ARTICLE, sentiment: 'MIXED' },
      { ...ARTICLE, publishedAt: 'yesterday' },
    ]) {
      const { service } = setup({ ...PAGE, items: [bad] });
      await expect(
        service.feed({ page: 1, pageSize: 20 }),
      ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    }
  });

  it('passes a refusal on as an HTTP error, never as an empty feed', async () => {
    const { service } = setup({ code: 'ACCESS_DENIED' }, 403);

    await expect(service.feed({ page: 1, pageSize: 20 })).rejects.toMatchObject(
      {
        code: 'HTTP_ERROR',
        status: 403,
      },
    );
  });

  it('is pending without an API', async () => {
    const pending = createPendingNewsService();
    await expect(pending.feed({ page: 1, pageSize: 20 })).rejects.toMatchObject(
      {
        code: 'NOT_CONFIGURED',
      },
    );
    await expect(pending.article('a1')).rejects.toMatchObject({
      code: 'NOT_CONFIGURED',
    });
  });
});
