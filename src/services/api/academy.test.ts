import { describe, expect, it, vi } from 'vitest';
import { createHttpAcademyService } from './academy';
import { decodeAcademyArticle } from './academy-dto';
import { createHttpClient } from './http-client';

/** Shapes of the backend branch feature/T-114-academy @ 54dd618. */
const SUMMARY = {
  slug: 'doc-bieu-do-nen',
  title: 'Đọc biểu đồ nến',
  summary: 'Mỗi cây nến kể lại cuộc giằng co.',
  level: 'BEGINNER',
  readingMinutes: 6,
  topicSlug: 'phan-tich-ky-thuat',
  topicName: 'Phân tích kỹ thuật',
  pathOrder: 8,
};
const ARTICLE = {
  ...SUMMARY,
  body: '## Một cây nến gồm những gì?\n\nText',
  appLink: '/markets',
  publishedAt: '2026-10-25T00:00:00Z',
  updatedAt: '2026-10-25T00:00:00Z',
  previous: { slug: 'lenh-market-limit-stop', title: 'Các loại lệnh' },
  next: null,
  related: [{ ...SUMMARY, slug: 'ema-rsi-macd', pathOrder: null }],
};

function setup(reply: unknown) {
  const calls: URL[] = [];
  const http = createHttpClient({
    baseUrl: 'https://api.example.test/api/v1',
    fetcher: vi.fn<typeof fetch>(async (input) => {
      calls.push(new URL(String(input)));
      return new Response(JSON.stringify(reply), { status: 200 });
    }),
    session: { accessToken: () => null, refresh: async () => 'ended' },
  });
  return { academy: createHttpAcademyService(http), calls };
}

describe('Academy adapter', () => {
  it('decodes a lesson with its neighbours and related lessons', () => {
    const article = decodeAcademyArticle(ARTICLE);
    expect(article.previous?.slug).toBe('lenh-market-limit-stop');
    expect(article.next).toBeNull();
    expect(article.related[0]?.pathOrder).toBeNull();
    expect(article.pathOrder).toBe(8);
  });

  it('refuses a lesson of an unknown level', () => {
    expect(() => decodeAcademyArticle({ ...ARTICLE, level: 'EXPERT' })).toThrow(
      'level',
    );
  });

  it('asks for lessons with their filters, leaving out the empty ones', async () => {
    const { academy, calls } = setup({
      items: [SUMMARY],
      page: 2,
      pageSize: 12,
      total: 13,
    });
    const page = await academy.articles({
      topic: 'phan-tich-ky-thuat',
      q: '',
      page: 2,
      pageSize: 12,
    });
    expect(page.items[0]?.slug).toBe('doc-bieu-do-nen');
    expect(calls[0]?.pathname).toBe('/api/v1/academy/articles');
    expect(Object.fromEntries(calls[0]?.searchParams ?? [])).toEqual({
      topic: 'phan-tich-ky-thuat',
      page: '2',
      pageSize: '12',
    });
  });

  it('reads a lesson by its slug and the glossary by its first letter', async () => {
    const lesson = setup(ARTICLE);
    await lesson.academy.article('doc-bieu-do-nen');
    expect(lesson.calls[0]?.pathname).toBe(
      '/api/v1/academy/articles/doc-bieu-do-nen',
    );
    const glossary = setup([]);
    await glossary.academy.terms({ letter: 'Đ' });
    expect(glossary.calls[0]?.pathname).toBe('/api/v1/academy/terms');
    expect(glossary.calls[0]?.searchParams.get('letter')).toBe('Đ');
  });
});
