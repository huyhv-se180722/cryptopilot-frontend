// @vitest-environment jsdom
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CommunityPage } from '../../pages/trader/CommunityPage';
import type { CommunityService } from '../../services/api/contracts';
import { createPendingCommunityService } from '../../services/api/community';
import { createPendingMarketService } from '../../services/api/market';
import type {
  FeedQuery,
  MarketPair,
  PostDraft,
  PostSummary,
} from '../../types/domain';
import { fakeAuth, page, renderRoutes, testTrader } from '../../test/render';

beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
});

const trader = () => fakeAuth({ restoreSession: async () => testTrader });

const POST: PostSummary = {
  id: 'p1',
  author: { userId: 'u-zarrar', displayName: 'Zarrar X', avatarUrl: null },
  authorStanding: { influenceScore: 105.73, followers: 4, followedByMe: false },
  title: 'ORDER breakout',
  excerpt: '$ORDER is showing a massive breakout.',
  postType: 'TEXT',
  market: null,
  official: false,
  officialCategory: null,
  status: 'PUBLISHED',
  sentiment: 'BULLISH',
  coins: [],
  cover: null,
  likeCount: 8,
  commentCount: 0,
  viewCount: 5300,
  bullishCount: 1,
  bearishCount: 2,
  myVote: null,
  likedByMe: false,
  savedByMe: false,
  createdAt: '2026-10-25T08:00:00Z',
  updatedAt: '2026-10-25T08:00:00Z',
};

function community(overrides: Partial<CommunityService>): CommunityService {
  const empty = { items: [], page: 1, pageSize: 20, total: 0 };
  return {
    ...createPendingCommunityService(),
    feed: async () => ({ ...empty, items: [POST], total: 1 }),
    pinned: async () => empty,
    influencers: async () => [
      {
        userId: 'u-cz',
        displayName: 'CZ',
        avatarUrl: null,
        influenceScore: 794.1,
        depthScore: 10,
        followers: 40,
        bullishPosts: 0,
        bearishPosts: 0,
        followedByMe: false,
        me: false,
      },
    ],
    trendingCoins: async () => [],
    ...overrides,
  };
}

describe('community feed as on CoinMarketCap (D-99)', () => {
  it('opens on Latest with the card, its score, votes, views and Top Influencers', async () => {
    const feed = vi.fn(community({}).feed);
    await renderRoutes(
      [page('/community', <CommunityPage />)],
      '/community',
      trader(),
      { community: community({ feed }) },
    );
    const card = await screen.findByRole('article', { name: 'ORDER breakout' });
    expect(feed.mock.calls[0]?.[0]).toMatchObject({
      tab: 'LATEST',
      page: 1,
      pageSize: 10,
    });
    expect(screen.getByRole('heading', { name: 'Latest Posts' })).toBeTruthy();
    expect(within(card).getByText('105.73 Influence Score')).toBeTruthy();
    expect(within(card).getByText('Bullish')).toBeTruthy();
    expect(within(card).getByText('5.3K')).toBeTruthy();
    // The cashtag links to its coin's feed.
    expect(
      within(card).getByRole('link', { name: '$ORDER' }).getAttribute('href'),
    ).toBe('/community?coin=ORDER');
    expect(await screen.findByText('794.10 Influence Score')).toBeTruthy();
    expect(screen.getByText('Neutral')).toBeTruthy();
  });

  it('follows the author and votes with the server answer', async () => {
    const user = userEvent.setup();
    const follow = vi.fn(async () => ({ active: true, count: 5 }));
    const vote = vi.fn(async () => ({
      myVote: 'BEARISH' as const,
      bullishCount: 1,
      bearishCount: 3,
    }));
    await renderRoutes(
      [page('/community', <CommunityPage />)],
      '/community',
      trader(),
      { community: community({ follow, vote }) },
    );
    const card = await screen.findByRole('article', { name: 'ORDER breakout' });
    await user.click(
      within(card).getByRole('button', { name: 'Follow Zarrar X' }),
    );
    expect(follow).toHaveBeenCalledWith('u-zarrar', true);
    expect(
      await within(card).findByRole('button', { name: 'Unfollow Zarrar X' }),
    ).toBeTruthy();
    await user.click(
      within(card).getByRole('button', { name: 'Vote bearish' }),
    );
    expect(vote).toHaveBeenCalledWith('p1', 'BEARISH');
    expect(
      await within(card).findByRole('button', { name: 'Take back your vote' }),
    ).toBeTruthy();
  });

  it('publishes from the Post dialog with the typed title, the stance and the cashtags', async () => {
    const user = userEvent.setup();
    const create = vi.fn(async (draft: PostDraft) => ({
      ...POST,
      title: draft.title,
      content: draft.content,
      media: [],
      mine: true,
    }));
    await renderRoutes(
      [page('/community', <CommunityPage />)],
      '/community',
      trader(),
      { community: community({ create }) },
    );
    await user.click(await screen.findByRole('button', { name: 'New post' }));
    const dialog = screen.getByRole('dialog', { name: 'Post' });
    await user.click(within(dialog).getByRole('button', { name: 'Post' }));
    expect(within(dialog).getByRole('alert').textContent).toBe(
      'The title has 5 to 150 characters.',
    );
    await user.type(within(dialog).getByLabelText('Title'), 'BTC weekly view');
    await user.type(
      within(dialog).getByLabelText('Content'),
      'Watching $btc and $ETH this week',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Bullish' }));
    expect(within(dialog).getByText('Coins: $BTC $ETH')).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: 'Post' }));
    expect(create).toHaveBeenCalledWith({
      title: 'BTC weekly view',
      content: 'Watching $btc and $ETH this week',
      market: null,
      coins: ['BTC', 'ETH'],
      media: [],
      sentiment: 'BULLISH',
    });
    expect(await screen.findByText('Post published.')).toBeTruthy();
  });

  it('offers the listed coins while a $ tag is typed and inserts the chosen one', async () => {
    const user = userEvent.setup();
    const pair = (base: string, name: string): MarketPair => ({
      pairId: 'pair-' + base,
      symbol: base + 'USDT',
      market: 'spot',
      baseAsset: base,
      quoteAsset: 'USDT',
      baseAssetName: name,
      logoUrl: null,
      tickSize: '0.01',
      stepSize: '0.001',
      minNotional: '5',
      displayOrder: 1,
    });
    await renderRoutes(
      [page('/community', <CommunityPage />)],
      '/community',
      trader(),
      {
        community: community({}),
        market: {
          ...createPendingMarketService(),
          listPairs: async () => [
            pair('BTC', 'Bitcoin'),
            pair('BNB', 'BNB'),
            pair('ETH', 'Ethereum'),
          ],
        },
      },
    );
    await user.click(await screen.findByRole('button', { name: 'New post' }));
    const dialog = screen.getByRole('dialog', { name: 'Post' });
    const content = within(dialog).getByLabelText('Content');
    await user.type(content, 'Watching $b');
    const list = within(dialog).getByRole('listbox', { name: 'Coins to tag' });
    expect(
      within(list)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual([
      expect.stringContaining('$BTC'),
      expect.stringContaining('$BNB'),
    ]);
    await user.keyboard('{ArrowDown}{Enter}');
    expect((content as HTMLTextAreaElement).value).toBe('Watching $BNB ');
    expect(within(dialog).queryByRole('listbox')).toBeNull();
    // Typing by name finds the coin too.
    await user.type(content, 'and $ether');
    await user.click(within(dialog).getByRole('option', { name: /\$ETH/ }));
    expect((content as HTMLTextAreaElement).value).toBe(
      'Watching $BNB and $ETH ',
    );
  });

  it('pages the feed with numbered pages, starting again on page 1 for another tab', async () => {
    const user = userEvent.setup();
    const feed = vi.fn(async (query: FeedQuery) => ({
      items: [POST],
      page: query.page,
      pageSize: 10,
      total: 25,
    }));
    await renderRoutes(
      [page('/community', <CommunityPage />)],
      '/community',
      trader(),
      { community: community({ feed }) },
    );
    const pages = await screen.findByRole('navigation', { name: 'Pages' });
    expect(within(pages).getByText('Page 1 of 3')).toBeTruthy();
    expect(
      within(pages)
        .getByRole('button', { name: 'Page 1' })
        .getAttribute('aria-current'),
    ).toBe('page');
    await user.click(within(pages).getByRole('button', { name: 'Page 3' }));
    expect(feed.mock.calls.at(-1)?.[0]).toMatchObject({ page: 3 });
    expect(await within(pages).findByText('Page 3 of 3')).toBeTruthy();
    expect(
      within(pages)
        .getByRole('button', { name: 'Next page' })
        .hasAttribute('disabled'),
    ).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Choose the feed' }));
    await user.click(screen.getByRole('menuitem', { name: 'For You' }));
    expect(feed.mock.calls.at(-1)?.[0]).toMatchObject({
      tab: 'TRENDING',
      page: 1,
    });
  });
});
