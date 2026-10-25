// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AcademyArticlePage } from '../../pages/guest/AcademyArticlePage';
import { AcademyGlossaryPage } from '../../pages/guest/AcademyGlossaryPage';
import { AcademyPage } from '../../pages/guest/AcademyPage';
import type { AcademyService } from '../../services/api/contracts';
import { createPendingAcademyService } from '../../services/api/academy';
import { ServiceError } from '../../services/api/errors';
import type { AcademyArticle, AcademyArticleSummary } from '../../types/domain';
import { fakeAuth, page, renderRoutes, testTrader } from '../../test/render';

const trader = () => fakeAuth({ restoreSession: async () => testTrader });

const LESSON: AcademyArticleSummary = {
  slug: 'tien-ma-hoa-la-gi',
  title: 'Tiền mã hóa là gì?',
  summary: 'Tài sản số trên một sổ cái công khai.',
  level: 'BEGINNER',
  readingMinutes: 5,
  topicSlug: 'nhap-mon-crypto',
  topicName: 'Nhập môn crypto',
  pathOrder: 1,
};
const ARTICLE: AcademyArticle = {
  ...LESSON,
  body: [
    '## Một định nghĩa ngắn',
    '',
    'Tiền mã hóa là **tài sản số**.',
    '',
    '## Bắt đầu từ đâu?',
    '',
    '- Đọc lộ trình',
  ].join('\n'),
  appLink: '/markets',
  publishedAt: '2026-10-25T00:00:00Z',
  updatedAt: '2026-10-25T00:00:00Z',
  previous: null,
  next: {
    slug: 'bitcoin-ethereum-va-altcoin',
    title: 'Bitcoin, Ethereum và altcoin',
  },
  related: [],
};

function academy(overrides: Partial<AcademyService>): AcademyService {
  return {
    ...createPendingAcademyService(),
    topics: async () => [
      {
        slug: 'nhap-mon-crypto',
        name: 'Nhập môn crypto',
        description: 'Cơ bản',
        articles: 3,
      },
    ],
    path: async () => [LESSON],
    articles: async (query) => ({
      items: [LESSON],
      page: query.page,
      pageSize: query.pageSize,
      total: 1,
    }),
    ...overrides,
  };
}

describe('Academy screens', () => {
  it('shows a Guest the path, the topics and the lessons in Vietnamese', async () => {
    await renderRoutes(
      [page('/academy', <AcademyPage />)],
      '/academy',
      fakeAuth(),
      { academy: academy({}) },
    );
    expect(
      await screen.findByRole('heading', { name: 'Học viện Crypto' }),
    ).toBeTruthy();
    expect(await screen.findByText('Bước 1')).toBeTruthy();
    expect(
      (
        await screen.findByRole('button', { name: /Nhập môn crypto/ })
      ).getAttribute('aria-pressed'),
    ).toBe('false');
    expect(
      (await screen.findAllByRole('link', { name: /Tiền mã hóa là gì\?/ })).map(
        (link) => link.getAttribute('href'),
      ),
    ).toContain('/academy/tien-ma-hoa-la-gi');
    expect(
      screen.getByText(
        'Nội dung chỉ nhằm mục đích giáo dục, không phải lời khuyên đầu tư.',
      ),
    ).toBeTruthy();
  });

  it('filters the lessons by the topic picked, from the first page', async () => {
    const user = userEvent.setup();
    const articles = vi.fn<AcademyService['articles']>(async (query) => ({
      items: [LESSON],
      page: query.page,
      pageSize: query.pageSize,
      total: 1,
    }));
    await renderRoutes(
      [page('/academy', <AcademyPage />)],
      '/academy?page=2',
      fakeAuth(),
      { academy: academy({ articles }) },
    );
    expect(articles).toHaveBeenLastCalledWith(
      { page: 2, pageSize: 12 },
      expect.anything(),
    );
    await user.click(
      await screen.findByRole('button', { name: /Nhập môn crypto/ }),
    );
    expect(articles).toHaveBeenLastCalledWith(
      { topic: 'nhap-mon-crypto', page: 1, pageSize: 12 },
      expect.anything(),
    );
  });

  it('renders a lesson with its contents, its app link and the next lesson', async () => {
    await renderRoutes(
      [page('/academy/:slug', <AcademyArticlePage />)],
      '/academy/tien-ma-hoa-la-gi',
      fakeAuth(),
      { academy: academy({ article: async () => ARTICLE }) },
    );
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Tiền mã hóa là gì?',
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Một định nghĩa ngắn' }).id,
    ).toBe('mot-dinh-nghia-ngan');
    expect(screen.getByText('tài sản số').tagName).toBe('STRONG');
    const contents = screen.getByRole('navigation', { name: 'Mục lục' });
    expect(
      contents.querySelector('a[href="#bat-dau-tu-dau"]')?.textContent,
    ).toBe('Bắt đầu từ đâu?');
    expect(
      screen
        .getByRole('link', { name: /Thử ngay trong ứng dụng/ })
        .getAttribute('href'),
    ).toBe('/markets');
    expect(
      screen
        .getByRole('link', { name: /Bitcoin, Ethereum và altcoin/ })
        .getAttribute('href'),
    ).toBe('/academy/bitcoin-ethereum-va-altcoin');
  });

  it('says a lesson that is not published does not exist', async () => {
    await renderRoutes(
      [page('/academy/:slug', <AcademyArticlePage />)],
      '/academy/ban-nhap',
      fakeAuth(),
      {
        academy: academy({
          article: async () => {
            throw new ServiceError('missing', 'HTTP_ERROR', 404, {
              status: 404,
              code: 'RESOURCE_NOT_FOUND',
              messageCode: 'MSG41',
              messageArgs: [],
              fieldErrors: {},
            });
          },
        }),
      },
    );
    expect(
      await screen.findByText('Bài học không tồn tại hoặc chưa được xuất bản.'),
    ).toBeTruthy();
  });

  it('filters the glossary by a first letter and links each term to its lesson', async () => {
    const user = userEvent.setup();
    const terms = vi.fn<AcademyService['terms']>(async () => [
      {
        slug: 'seed-phrase',
        term: 'Seed phrase',
        definition: 'Dãy 12 hoặc 24 từ.',
        articleSlug: 'vi-khoa-rieng-seed-phrase',
        articleTitle: 'Ví crypto',
      },
    ]);
    await renderRoutes(
      [page('/academy/glossary', <AcademyGlossaryPage />)],
      '/academy/glossary',
      fakeAuth(),
      { academy: academy({ terms }) },
    );
    expect(await screen.findByText('Seed phrase')).toBeTruthy();
    expect(
      screen.getByRole('link', { name: /Đọc bài học/ }).getAttribute('href'),
    ).toBe('/academy/vi-khoa-rieng-seed-phrase');
    await user.click(screen.getByRole('button', { name: 'S' }));
    expect(terms).toHaveBeenLastCalledWith({ letter: 'S' }, expect.anything());
  });

  it('lets a Trader mark a lesson as learned and take the mark off', async () => {
    const user = userEvent.setup();
    let completed: { slug: string; completedAt: string }[] = [];
    const mark = vi.fn<AcademyService['mark']>(async (slug) => {
      const lesson = { slug, completedAt: '2026-10-25T10:00:00Z' };
      completed = [lesson];
      return lesson;
    });
    const unmark = vi.fn<AcademyService['unmark']>(async () => {
      completed = [];
    });
    await renderRoutes(
      [page('/academy/:slug', <AcademyArticlePage />)],
      '/academy/tien-ma-hoa-la-gi',
      trader(),
      {
        academy: academy({
          article: async () => ARTICLE,
          progress: async () => ({
            completed,
            publishedTotal: 21,
            pathCompleted: completed.length,
            pathTotal: 11,
          }),
          mark,
          unmark,
        }),
      },
    );
    await user.click(
      await screen.findByRole('button', { name: 'Đánh dấu đã học' }),
    );
    expect(mark).toHaveBeenCalledWith('tien-ma-hoa-la-gi');
    const learned = await screen.findByRole('button', { name: 'Đã học' });
    expect(learned.getAttribute('aria-pressed')).toBe('true');
    await user.click(learned);
    expect(unmark).toHaveBeenCalledWith('tien-ma-hoa-la-gi');
    expect(
      await screen.findByRole('button', { name: 'Đánh dấu đã học' }),
    ).toBeTruthy();
  });

  it('invites a Guest to sign in instead of keeping a progress', async () => {
    const progress = vi.fn<AcademyService['progress']>();
    await renderRoutes(
      [page('/academy/:slug', <AcademyArticlePage />)],
      '/academy/tien-ma-hoa-la-gi',
      fakeAuth(),
      { academy: academy({ article: async () => ARTICLE, progress }) },
    );
    expect(
      (
        await screen.findByRole('link', {
          name: 'Đăng nhập để lưu tiến độ học',
        })
      ).getAttribute('href'),
    ).toBe('/login');
    expect(progress).not.toHaveBeenCalled();
  });

  it("shows a Trader's progress on the beginner path", async () => {
    await renderRoutes(
      [page('/academy', <AcademyPage />)],
      '/academy',
      trader(),
      {
        academy: academy({
          progress: async () => ({
            completed: [
              { slug: LESSON.slug, completedAt: '2026-10-25T10:00:00Z' },
            ],
            publishedTotal: 21,
            pathCompleted: 1,
            pathTotal: 11,
          }),
        }),
      },
    );
    expect(
      await screen.findByText('Bạn đã học 1/11 bài của lộ trình'),
    ).toBeTruthy();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe(
      '1',
    );
    expect(screen.getAllByText('Đã học').length).toBeGreaterThan(0);
  });
});
