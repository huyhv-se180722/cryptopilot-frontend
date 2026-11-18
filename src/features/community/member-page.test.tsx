// @vitest-environment jsdom
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemberPage } from '../../pages/trader/MemberPage';
import type {
  CommunityService,
  ProfileService,
} from '../../services/api/contracts';
import { createPendingCommunityService } from '../../services/api/community';
import { ServiceError } from '../../services/api/errors';
import { createPendingProfileService } from '../../services/api/profile';
import type {
  CommunityProfileUpdate,
  MemberProfile,
  UserProfile,
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

const emptyPage = { items: [], page: 1, pageSize: 10, total: 0 };

const LAN: MemberProfile = {
  userId: 'lan',
  displayName: 'Lan Pham',
  avatarUrl: null,
  joinedAt: '2026-09-01T00:00:00Z',
  posts: 3,
  likesReceived: 10,
  followers: 1200,
  following: 4,
  followedByMe: false,
  blockedByMe: false,
  me: false,
  bio: 'Swing trader, BTC and ETH',
  websiteUrl: 'https://x.com/lan_pham',
  bannerUrl: null,
  influenceScore: 146.67,
  depthScore: 12.5,
};

function community(overrides: Partial<CommunityService>): CommunityService {
  return {
    ...createPendingCommunityService(),
    feed: async () => emptyPage,
    pinned: async () => emptyPage,
    influencers: async () => [],
    member: async () => LAN,
    tokenMentions: async () => [
      {
        symbol: 'BTC',
        name: 'Bitcoin',
        posts: 3,
        sharePercent: 75,
        bullishPosts: 2,
        bearishPosts: 0,
        lastPostAt: '2026-11-01T00:00:00Z',
      },
    ],
    memberComments: async () => ({
      items: [
        {
          commentId: 'c1',
          postId: 'p1',
          reply: true,
          content: 'Agreed, the range holds.',
          likes: 2,
          createdAt: '2026-11-01T00:00:00Z',
          postTitle: 'BTC breakout',
          postExcerpt: 'Watching the range',
        },
      ],
      page: 1,
      pageSize: 10,
      total: 1,
    }),
    memberReactions: async () => emptyPage,
    ...overrides,
  };
}

const signedIn = fakeAuth({ restoreSession: async () => testTrader });

describe('member page (D-99)', () => {
  it("shows a member's card, insights and token mentions, and their comments", async () => {
    const user = userEvent.setup();
    await renderRoutes(
      [page('/community/members/:memberId', <MemberPage />)],
      '/community/members/lan',
      signedIn,
      { community: community({}) },
    );

    expect(
      await screen.findByRole('heading', { name: /Lan Pham/ }),
    ).toBeTruthy();
    expect(screen.getByText('Swing trader, BTC and ETH')).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'x.com/lan_pham' }).getAttribute('href'),
    ).toBe('https://x.com/lan_pham');
    expect(screen.getByText('146.67')).toBeTruthy();
    expect(screen.getByText('12.50')).toBeTruthy();
    expect(
      await screen.findByLabelText(
        'BTC: 75% of their mentions, 3 posts, 2 Bullish and 0 Bearish',
      ),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Follow Lan Pham' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('heading', { name: 'Nothing Here Yet' }),
    ).toBeTruthy();

    await user.click(screen.getByRole('tab', { name: 'Comments' }));
    expect(await screen.findByText('Agreed, the range holds.')).toBeTruthy();
    const post = screen.getByRole('link', { name: /Replied on/ });
    expect(post.getAttribute('href')).toBe('/community/p1');
    expect(within(post).getByText('BTC breakout')).toBeTruthy();

    await user.click(screen.getByRole('tab', { name: 'Reactions' }));
    expect(await screen.findByText('No reactions yet.')).toBeTruthy();
  });

  it('shows "--" for the scores of a member who has not posted', async () => {
    await renderRoutes(
      [page('/community/members/:memberId', <MemberPage />)],
      '/community/members/lan',
      signedIn,
      {
        community: community({
          member: async () => ({ ...LAN, posts: 0, influenceScore: 0 }),
          tokenMentions: async () => [],
        }),
      },
    );
    expect(await screen.findByText('No coin mentioned yet.')).toBeTruthy();
    expect(screen.getAllByText('--')).toHaveLength(2);
  });

  it('says MSG41 for a member who does not exist or blocks the reader', async () => {
    await renderRoutes(
      [page('/community/members/:memberId', <MemberPage />)],
      '/community/members/gone',
      signedIn,
      {
        community: community({
          member: async () => {
            throw new ServiceError('gone', 'HTTP_ERROR', 404, {
              status: 404,
              code: 'RESOURCE_NOT_FOUND',
              messageCode: 'MSG41',
            });
          },
        }),
      },
    );
    expect(
      await screen.findByRole('heading', {
        name: 'No results found.',
      }),
    ).toBeTruthy();
  });

  it('edits one’s own page, keeping the images it has and refusing a link that is not https', async () => {
    const user = userEvent.setup();
    const own: UserProfile = {
      email: 'trader@example.test',
      displayName: 'Test Trader',
      avatarUrl: 'https://img.example/a.png',
      defaultCapital: null,
      defaultRiskPercent: null,
      tradingStyle: null,
      riskProfile: 'CONSERVATIVE',
      notifyEmail: true,
      notifyPush: true,
      bio: null,
      websiteUrl: null,
      bannerUrl: null,
      avatarPublicId: 'cryptopilot/profiles/test-trader/a',
      bannerPublicId: null,
    };
    const saved = vi.fn<(update: CommunityProfileUpdate) => Promise<void>>(
      async () => undefined,
    );
    const profile: ProfileService = {
      ...createPendingProfileService(),
      get: async () => own,
      updateCommunityProfile: saved,
    };
    await renderRoutes(
      [page('/community/members/:memberId', <MemberPage />)],
      '/community/members/test-trader',
      signedIn,
      {
        community: community({
          member: async () => ({
            ...LAN,
            userId: 'test-trader',
            displayName: 'Test Trader',
            me: true,
          }),
        }),
        profile,
      },
    );

    expect(
      await screen.findByText(
        'You can post your first post, or discover and follow accounts you are interested in!',
      ),
    ).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    const bio = await screen.findByLabelText('Bio');
    await user.type(bio, 'Day trader');
    const link = screen.getByLabelText('Link');
    await user.type(link, 'http://x.com/me');
    expect(
      screen.getByText('Enter one link starting with https://'),
    ).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);

    await user.clear(link);
    await user.type(link, 'https://x.com/me');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(saved).toHaveBeenCalledWith({
      bio: 'Day trader',
      websiteUrl: 'https://x.com/me',
      avatarPublicId: 'cryptopilot/profiles/test-trader/a',
      bannerPublicId: null,
    });
    expect(await screen.findByText('Profile saved.')).toBeTruthy();
  });
});
