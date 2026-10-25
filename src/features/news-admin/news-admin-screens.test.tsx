// @vitest-environment jsdom
import { beforeAll, describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminNewsArticlesPage } from '../../pages/admin/AdminNewsArticlesPage';
import { AdminNewsSourcesPage } from '../../pages/admin/AdminNewsSourcesPage';
import type { NewsAdminService } from '../../services/api/contracts';
import { ServiceError } from '../../services/api/errors';
import { createPendingNewsAdminService } from '../../services/api/news-admin';
import type {
  AdminNewsArticle,
  AdminNewsArticleQuery,
  NewsSource,
  NewsSourceDraft,
  Session,
} from '../../types/domain';
import { fakeAuth, page, renderRoutes } from '../../test/render';
import { formatInstantLocal } from '../../utils/instant-format';

beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
});

const admin: Session = {
  user: {
    id: 'test-admin',
    email: 'admin@example.test',
    displayName: 'Test Admin',
    role: 'Admin',
    status: 'active',
  },
  entitlements: 'unknown',
};
const signedIn = fakeAuth({ restoreSession: async () => admin });

const minutesAgo = (n: number) =>
  new Date(Date.now() - n * 60_000).toISOString();
const lastCrawledAt = minutesAgo(12);
const nextCrawlAt = new Date(Date.now() + 18 * 60_000).toISOString();

const desk: NewsSource = {
  id: 's1',
  sourceName: 'Markets Desk',
  feedUrl: 'https://feeds.example.test/markets',
  crawlIntervalMinutes: 30,
  active: true,
  categoryFilter: null,
  bodySelector: null,
  excludedSelectors: null,
  userAgent: null,
  lastCrawledAt,
  lastCrawl: {
    startedAt: lastCrawledAt,
    status: 'SUCCESS',
    articlesFound: 10,
    articlesInserted: 2,
  },
  nextCrawlAt,
};
const off: NewsSource = {
  ...desk,
  id: 's2',
  sourceName: 'Quiet Desk',
  active: false,
  nextCrawlAt: null,
};

function problem(status: number, code: string, messageCode: string, more = {}) {
  return new ServiceError('refused', 'HTTP_ERROR', status, {
    status,
    code,
    messageCode,
    messageArgs: [],
    fieldErrors: {},
    ...more,
  });
}

function service(overrides: Partial<NewsAdminService>): NewsAdminService {
  return {
    ...createPendingNewsAdminService(),
    sources: async () => [desk, off],
    ...overrides,
  };
}

async function openSources(newsAdmin: NewsAdminService) {
  return renderRoutes(
    [page('/admin/news-sources', <AdminNewsSourcesPage />)],
    '/admin/news-sources',
    signedIn,
    { newsAdmin },
  );
}

describe('news sources console (SCR-41, UC-49, T-080b)', () => {
  it('asks first, showing the source schedule, then crawls and reports the result', async () => {
    const user = userEvent.setup();
    const crawled: string[] = [];
    await openSources(
      service({
        crawlNow: async (id) => {
          crawled.push(id);
          return {
            id: 'log',
            startedAt: new Date().toISOString(),
            finishedAt: new Date().toISOString(),
            status: 'SUCCESS',
            articlesFound: 8,
            articlesInserted: 3,
            errorMessage: null,
          };
        },
      }),
    );

    await user.click(
      await screen.findByRole('button', { name: 'Crawl Markets Desk now' }),
    );
    const dialog = screen.getByRole('dialog', {
      name: 'Crawl Markets Desk now?',
    });
    const popup = within(dialog);
    expect(
      popup.getByText('This source is crawled automatically every 30 minutes.'),
    ).toBeTruthy();
    expect(
      popup.getByText(
        `Last crawl: ${formatInstantLocal(lastCrawledAt)} (12 minutes ago).`,
      ),
    ).toBeTruthy();
    expect(
      popup.getByText(
        `Next scheduled crawl: ${formatInstantLocal(nextCrawlAt)}.`,
      ),
    ).toBeTruthy();
    expect(crawled).toEqual([]);

    await user.click(popup.getByRole('button', { name: 'Crawl now' }));
    expect(crawled).toEqual(['s1']);
    expect(
      await screen.findByText('Crawl finished: 3 new articles of 8.'),
    ).toBeTruthy();
  });

  it('says a switched-off source is not crawled on its own, and shows the wait of MSG50', async () => {
    const user = userEvent.setup();
    await openSources(
      service({
        crawlNow: async () => {
          throw problem(429, 'NEWS_SOURCE_CRAWLED_RECENTLY', 'MSG50', {
            messageArgs: ['42'],
          });
        },
      }),
    );

    await user.click(
      await screen.findByRole('button', { name: 'Crawl Quiet Desk now' }),
    );
    const popup = within(
      screen.getByRole('dialog', { name: 'Crawl Quiet Desk now?' }),
    );
    expect(
      popup.getByText(
        'The source is switched off, so it is not crawled automatically.',
      ),
    ).toBeTruthy();
    expect(popup.queryByText(/Next scheduled crawl/)).toBeNull();

    await user.click(popup.getByRole('button', { name: 'Crawl now' }));
    expect(
      await screen.findByText(
        'This source was crawled less than a minute ago. Try again in 42 seconds.',
      ),
    ).toBeTruthy();
  });

  it('checks a new source before sending it, and shows the feed the server could not read under its field', async () => {
    const user = userEvent.setup();
    const sent: NewsSourceDraft[] = [];
    await openSources(
      service({
        createSource: async (draft) => {
          sent.push(draft);
          throw problem(400, 'NEWS_FEED_UNREADABLE', 'MSG15', {
            fieldErrors: { feedUrl: 'MSG15' },
          });
        },
      }),
    );

    await user.click(await screen.findByRole('button', { name: 'Add source' }));
    const form = within(
      screen.getByRole('dialog', { name: 'Add news source' }),
    );
    await user.type(form.getByLabelText('Name'), 'New Desk');
    await user.type(
      form.getByLabelText('Feed URL'),
      'https://new.example.test/rss',
    );
    const interval = form.getByLabelText('Crawl interval (minutes)');
    await user.clear(interval);
    await user.type(interval, '10');
    await user.click(form.getByRole('button', { name: 'Save' }));
    expect(
      await form.findByText('The crawl interval is at least 15 minutes.'),
    ).toBeTruthy();
    expect(sent).toEqual([]);

    await user.clear(interval);
    await user.type(interval, '20');
    await user.click(form.getByRole('button', { name: 'Save' }));
    expect(
      await form.findByText(
        'Enter the http or https address of an RSS or Atom feed, or check that it can be read.',
      ),
    ).toBeTruthy();
    expect(sent).toEqual([
      {
        sourceName: 'New Desk',
        feedUrl: 'https://new.example.test/rss',
        crawlIntervalMinutes: 20,
        active: true,
        categoryFilter: null,
        bodySelector: null,
        excludedSelectors: null,
        userAgent: null,
      },
    ]);
  });

  it('explains that a source articles came from cannot be deleted', async () => {
    const user = userEvent.setup();
    await openSources(
      service({
        deleteSource: async () => {
          throw problem(409, 'NEWS_SOURCE_IN_USE', 'MSG43');
        },
      }),
    );

    await user.click(
      await screen.findByRole('button', { name: 'Delete Markets Desk' }),
    );
    await user.click(
      within(
        screen.getByRole('dialog', { name: 'Delete news source?' }),
      ).getByRole('button', { name: 'Delete' }),
    );
    expect(
      await screen.findByText(
        'Articles came from this source, so it cannot be deleted. Switch it off instead.',
      ),
    ).toBeTruthy();
  });
});

const failed: AdminNewsArticle = {
  id: 'a1',
  sourceId: 's1',
  source: 'Markets Desk',
  title: 'Bitcoin holds $81K',
  aiTitle: null,
  originalUrl: 'https://news.example.test/a1',
  excerpt: 'Bitcoin traded flat.',
  aiSummary: null,
  sentiment: null,
  publishedAt: minutesAgo(90),
  collectedAt: minutesAgo(85),
  status: 'FAILED',
  summaryAttempts: 3,
  summaryError: 'the summary tells the reader to trade',
  summaryAttemptedAt: minutesAgo(10),
  hiddenAt: null,
};

describe('news articles console (T-080b, D-124)', () => {
  it('filters by status, hides after asking, and reports a refused summary', async () => {
    const user = userEvent.setup();
    const asked: Omit<AdminNewsArticleQuery, 'page' | 'pageSize'>[] = [];
    const actions: string[] = [];
    await renderRoutes(
      [page('/admin/news-articles', <AdminNewsArticlesPage />)],
      '/admin/news-articles',
      signedIn,
      {
        newsAdmin: service({
          articles: async ({ status, sourceId }) => {
            asked.push({
              ...(status ? { status } : {}),
              ...(sourceId ? { sourceId } : {}),
            });
            return { items: [failed], page: 1, pageSize: 20, total: 1 };
          },
          hide: async (id) => {
            actions.push('hide ' + id);
            return { ...failed, status: 'HIDDEN', hiddenAt: minutesAgo(0) };
          },
          summarize: async (id) => {
            actions.push('summarize ' + id);
            return { ...failed, summaryAttempts: 4 };
          },
        }),
      },
    );

    expect(await screen.findByText('3 attempts')).toBeTruthy();
    expect(
      screen.getByText('the summary tells the reader to trade'),
    ).toBeTruthy();
    await user.click(screen.getByRole('radio', { name: 'Failed' }));
    expect(asked.at(-1)).toEqual({ status: 'FAILED' });
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Source' }),
      's1',
    );
    expect(asked.at(-1)).toEqual({ status: 'FAILED', sourceId: 's1' });

    await user.click(
      screen.getByRole('button', { name: 'Hide Bitcoin holds $81K' }),
    );
    expect(actions).toEqual([]);
    await user.click(
      within(
        screen.getByRole('dialog', { name: 'Hide this article?' }),
      ).getByRole('button', { name: 'Hide' }),
    );
    expect(
      await screen.findByText('Article hidden from the feed.'),
    ).toBeTruthy();

    await user.click(
      screen.getByRole('button', {
        name: 'Summarize Bitcoin holds $81K again',
      }),
    );
    expect(
      await screen.findByText(
        'The AI answer was refused: the summary tells the reader to trade',
      ),
    ).toBeTruthy();
    expect(actions).toEqual(['hide a1', 'summarize a1']);
  });

  it('says so when the AI service cannot summarize now', async () => {
    const user = userEvent.setup();
    await renderRoutes(
      [page('/admin/news-articles', <AdminNewsArticlesPage />)],
      '/admin/news-articles',
      signedIn,
      {
        newsAdmin: service({
          articles: async () => ({
            items: [failed],
            page: 1,
            pageSize: 20,
            total: 1,
          }),
          summarize: async () => {
            throw problem(503, 'NEWS_SUMMARY_UNAVAILABLE', 'MSG31');
          },
        }),
      },
    );

    await user.click(
      await screen.findByRole('button', {
        name: 'Summarize Bitcoin holds $81K again',
      }),
    );
    expect(
      await screen.findByText(
        'The AI service is not available right now. Try again later.',
      ),
    ).toBeTruthy();
  });
});
