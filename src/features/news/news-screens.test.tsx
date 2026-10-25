// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NewsArticlePage } from '../../pages/trader/NewsArticlePage';
import { NewsPage } from '../../pages/trader/NewsPage';
import type { NewsService } from '../../services/api/contracts';
import { createPendingNewsService } from '../../services/api/news';
import type {
  NewsArticle,
  NewsArticleDetail,
  NewsQuery,
} from '../../types/domain';
import { fakeAuth, page, renderRoutes, testTrader } from '../../test/render';

const signedIn = fakeAuth({ restoreSession: async () => testTrader });

const summarized: NewsArticle = {
  id: 'a1',
  title: 'ETF Bitcoin bị rút $635 triệu',
  originalTitle: 'Bitcoin ETFs see $635M outflows',
  source: 'Desk',
  originalUrl: 'https://news.example.test/a1',
  publishedAt: new Date(Date.now() - 2 * 3_600_000).toISOString(),
  summary: 'Quỹ ETF Bitcoin bị rút ròng $635 triệu.',
  aiSummarized: true,
  sentiment: 'BEARISH',
  coins: [
    { symbol: 'BTC', primary: true },
    { symbol: 'ETH', primary: false },
  ],
  imageUrl: 'https://img.example.test/a1.jpg',
};
const collected: NewsArticle = {
  ...summarized,
  id: 'a2',
  title: 'Ether staking grows',
  originalTitle: 'Ether staking grows',
  summary: 'Staking deposits rose.',
  aiSummarized: false,
  sentiment: null,
  coins: [],
  imageUrl: null,
};

function service(overrides: Partial<NewsService>): NewsService {
  return {
    ...createPendingNewsService(),
    ...overrides,
  };
}

async function openNews(news: NewsService, path = '/news') {
  return renderRoutes(
    [
      page('/news', <NewsPage />),
      page('/news/:articleId', <NewsArticlePage />),
    ],
    path,
    signedIn,
    { news },
  );
}

describe('news screen (SCR-28, UC-34)', () => {
  it('lists each article like a news site, in Vietnamese, opening its page in the app', async () => {
    await openNews(
      service({
        feed: async () => ({
          items: [summarized, collected],
          page: 1,
          pageSize: 20,
          total: 2,
        }),
      }),
    );

    const [first, second] = await screen.findAllByRole('article');
    const one = within(first!);
    const link = one.getByRole('link', { name: /ETF Bitcoin bị rút/ });
    expect(link.getAttribute('href')).toBe('/news/a1');
    expect(link.getAttribute('target')).toBeNull();
    expect(
      one.getByText('Quỹ ETF Bitcoin bị rút ròng $635 triệu.'),
    ).toBeTruthy();
    expect(first!.querySelector('img')?.getAttribute('src')).toBe(
      'https://img.example.test/a1.jpg',
    );
    expect(one.getByText('Tiêu cực')).toBeTruthy();
    expect(one.getByText('2 giờ trước')).toBeTruthy();
    expect(one.getByRole('link', { name: 'BTC' }).getAttribute('href')).toBe(
      '/news?coin=BTC',
    );
    const two = within(second!);
    expect(second!.querySelector('img')).toBeNull();
    expect(two.queryByText('Tiêu cực')).toBeNull();
    expect(two.getByText('Staking deposits rose.')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Tin tức' })).toBeTruthy();
    expect(screen.getByText(/không phải khuyến nghị mua hay bán/)).toBeTruthy();
  });

  it('reads the filters from the address, 7 days by default, and changes them', async () => {
    const user = userEvent.setup();
    const asked: Omit<NewsQuery, 'page' | 'pageSize'>[] = [];
    await openNews(
      service({
        feed: async ({ coin, sentiment, range }) => {
          asked.push({
            ...(coin ? { coin } : {}),
            ...(sentiment ? { sentiment } : {}),
            ...(range ? { range } : {}),
          });
          return { items: [], page: 1, pageSize: 20, total: 0 };
        },
      }),
      '/news?coin=btc',
    );

    expect(
      await screen.findByText('Không có bài nào khớp bộ lọc.'),
    ).toBeTruthy();
    expect(asked.at(-1)).toEqual({ coin: 'BTC', range: '7d' });

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Xu hướng' }),
      'BULLISH',
    );
    await user.click(screen.getByRole('radio', { name: '24 giờ' }));
    expect(asked.at(-1)).toEqual({
      coin: 'BTC',
      sentiment: 'BULLISH',
      range: '24h',
    });

    await user.click(screen.getByRole('button', { name: /Xoá bộ lọc/ }));
    expect(asked.at(-1)).toEqual({ range: '7d' });
  });

  it('loads the next page on request', async () => {
    const user = userEvent.setup();
    await openNews(
      service({
        feed: async (q) => ({
          items: [
            { ...summarized, id: 'p' + q.page, title: 'Story ' + q.page },
          ],
          page: q.page,
          pageSize: 1,
          total: 2,
        }),
      }),
    );

    expect(await screen.findByText('Story 1')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Xem thêm' }));
    expect(await screen.findByText('Story 2')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Xem thêm' })).toBeNull();
  });

  it('says so when the feed cannot be read, and retries', async () => {
    const user = userEvent.setup();
    let down = true;
    await openNews(
      service({
        feed: async () => {
          if (down) throw new Error('down');
          return { items: [collected], page: 1, pageSize: 20, total: 1 };
        },
      }),
    );

    const retry = await screen.findByRole('button', { name: 'Try again' });
    expect(screen.queryByRole('article')).toBeNull();
    down = false;
    await user.click(retry);
    expect(await screen.findByText('Ether staking grows')).toBeTruthy();
  });

  it('shows the empty feed with its hint', async () => {
    await openNews(
      service({
        feed: async () => ({ items: [], page: 1, pageSize: 20, total: 0 }),
      }),
    );

    expect(await screen.findByText('Chưa có tin')).toBeTruthy();
    expect(
      screen.getByText('Bài mới xuất hiện vài phút sau khi các nguồn đăng.'),
    ).toBeTruthy();
    expect(screen.queryByText(/24 giờ qua/)).toBeNull();
  });
});

describe('news article page (SCR-28, D-125)', () => {
  const detail: NewsArticleDetail = {
    ...summarized,
    body: 'Quỹ ETF Bitcoin bị rút ròng $635 triệu trong tuần.\n\nGiới phân tích cho rằng dòng tiền đang thận trọng.',
  };

  it('reads the article the AI wrote, with its cover, and names the source at the end', async () => {
    await openNews(service({ article: async () => detail }), '/news/a1');

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'ETF Bitcoin bị rút $635 triệu',
      }),
    ).toBeTruthy();
    expect(
      screen.getByText('Tiêu đề gốc: Bitcoin ETFs see $635M outflows'),
    ).toBeTruthy();
    expect(
      screen.getByText('Quỹ ETF Bitcoin bị rút ròng $635 triệu trong tuần.'),
    ).toBeTruthy();
    expect(
      screen.getByText('Giới phân tích cho rằng dòng tiền đang thận trọng.'),
    ).toBeTruthy();
    expect(
      screen.getByRole('article').querySelector('img')?.getAttribute('src'),
    ).toBe('https://img.example.test/a1.jpg');
    expect(screen.getByText('Ảnh: Desk')).toBeTruthy();
    const original = screen.getByRole('link', { name: /Xem bài gốc/ });
    expect(original.getAttribute('href')).toBe('https://news.example.test/a1');
    expect(original.getAttribute('target')).toBe('_blank');
    expect(original.getAttribute('rel')).toBe('noopener noreferrer');
    expect(screen.getByText(/biên tập lại và rút gọn từ bài gốc/)).toBeTruthy();
    expect(
      screen.getByRole('link', { name: /Tất cả tin tức/ }).getAttribute('href'),
    ).toBe('/news');
  });

  it('shows the summary while the article is not written yet, and a placeholder without a cover', async () => {
    await openNews(
      service({
        article: async () => ({ ...detail, body: null, imageUrl: null }),
      }),
      '/news/a1',
    );

    expect(
      await screen.findByText('Quỹ ETF Bitcoin bị rút ròng $635 triệu.'),
    ).toBeTruthy();
    expect(screen.getByText(/đang được biên tập/)).toBeTruthy();
    expect(screen.getByRole('article').querySelector('img')).toBeNull();
    expect(screen.queryByText('Ảnh: Desk')).toBeNull();
  });

  it('lists the newest other articles beside the one being read', async () => {
    await openNews(
      service({
        article: async () => detail,
        feed: async () => ({
          items: [summarized, collected],
          page: 1,
          pageSize: 7,
          total: 2,
        }),
      }),
      '/news/a1',
    );

    const latest = await screen.findByRole('region', { name: 'Tin mới nhất' });
    const link = await within(latest).findByRole('link', {
      name: /Ether staking grows/,
    });
    expect(link.getAttribute('href')).toBe('/news/a2');
    expect(
      within(latest).queryByText('ETF Bitcoin bị rút $635 triệu'),
    ).toBeNull();
  });

  it('says so when the article is gone', async () => {
    await openNews(
      service({
        article: async () => {
          throw Object.assign(new Error('gone'), { status: 404 });
        },
      }),
      '/news/a1',
    );

    expect(await screen.findByText('Bài viết không còn')).toBeTruthy();
  });
});
