import type {
  MarketType,
  OfficialCategory,
  PostAuthor,
  PostMedia,
} from '../../types/domain';

/**
 * DEVELOPMENT ONLY. Community seed written for the fixtures (not from the
 * prototype): authors, posts, comments and reports exercise the feed tabs,
 * the pinned announcements, a hidden own post, a video post, a long post,
 * a deleted comment kept for its replies, and an already reported post.
 * Times are minutes before the moment the fixture is built.
 */
export interface DevMember extends PostAuthor {
  displayName: string;
  joinedDaysAgo: number;
}

export const DEV_ADMIN_AUTHOR: DevMember = {
  userId: 'dev-member-admin',
  displayName: 'CryptoPilot team (fixture)',
  avatarUrl: null,
  joinedDaysAgo: 120,
};

export const devMembers: readonly DevMember[] = [
  {
    userId: 'dev-member-1',
    displayName: 'Minh Tran (fixture)',
    avatarUrl: null,
    joinedDaysAgo: 64,
  },
  {
    userId: 'dev-member-2',
    displayName: 'Lan Pham (fixture)',
    avatarUrl: null,
    joinedDaysAgo: 41,
  },
  {
    userId: 'dev-member-3',
    displayName: 'Quoc Bao (fixture)',
    avatarUrl: null,
    joinedDaysAgo: 12,
  },
];

export interface DevPostSeed {
  id: string;
  authorId: string;
  title: string;
  content: string;
  market: MarketType | null;
  coins: readonly string[];
  official?: OfficialCategory;
  hidden?: boolean;
  media?: readonly Omit<PostMedia, 'publicId'>[];
  minutesAgo: number;
  /** Members who liked it; 'me' is the signed-in Trader. */
  likedBy: readonly string[];
  savedByMe?: boolean;
}

const still = (n: number) =>
  'data:image/svg+xml,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675"><rect width="1200" height="675" fill="#1f2a3d"/><path d="M0 ${500 - n * 20} L300 ${420 - n * 10} L600 ${460 + n * 5} L900 ${300 - n * 15} L1200 ${340}" stroke="#3b82f6" stroke-width="8" fill="none"/><text x="40" y="80" fill="#9aa4b2" font-family="sans-serif" font-size="40">Fixture chart ${n}</text></svg>`,
  );

const LONG =
  'Position size starts from the stop, not from the entry. ' +
  'I decide where the idea is wrong first, measure the distance, and only then size the trade so that the loss at the stop is the share of capital I accept. '.repeat(
    6,
  ) +
  '\n\nThe same rule works on Futures, but leverage only changes the margin, not the risk at the stop.';

export const devPostSeeds: readonly DevPostSeed[] = [
  {
    id: 'dev-post-official-1',
    authorId: DEV_ADMIN_AUTHOR.userId,
    title: 'Community rules and how reports are reviewed',
    content:
      'Posts share analysis and questions, never signals to copy. Reports go to the moderation queue and an administrator decides on each one. Repeated violations can lead to a warning or a ban.',
    market: null,
    coins: [],
    official: 'ANNOUNCEMENT',
    minutesAgo: 60 * 30,
    likedBy: ['dev-member-1', 'dev-member-2'],
  },
  {
    id: 'dev-post-official-2',
    authorId: DEV_ADMIN_AUTHOR.userId,
    title: 'Reading the setup score: what each component measures',
    content:
      'The setup score adds trend, momentum, volatility and volume components. It describes the chart; it is not a forecast and not advice.',
    market: 'spot',
    coins: ['BTC'],
    official: 'EDUCATION',
    minutesAgo: 60 * 50,
    likedBy: ['dev-member-3'],
  },
  {
    id: 'dev-post-1',
    authorId: 'dev-member-1',
    title: 'BTC is back at the weekly support for the third time',
    content:
      'Each test of the level came with lower volume. I am waiting for a daily close above the last swing high before planning anything.\n\nWhat do you watch on the retest?',
    market: 'spot',
    coins: ['BTC'],
    media: [
      {
        kind: 'IMAGE',
        url: still(1),
        thumbnailUrl: null,
        width: 1200,
        height: 675,
        durationSeconds: null,
      },
    ],
    minutesAgo: 45,
    likedBy: ['dev-member-2', 'dev-member-3', 'me'],
    savedByMe: true,
  },
  {
    id: 'dev-post-2',
    authorId: 'dev-member-2',
    title: 'How I size positions before every plan',
    content: LONG,
    market: null,
    coins: [],
    minutesAgo: 60 * 5,
    likedBy: ['dev-member-1', 'dev-member-3'],
  },
  {
    id: 'dev-post-3',
    authorId: 'dev-member-3',
    title: 'ETH and SOL funding turned negative together',
    content:
      'Both perpetuals show negative funding since this morning while open interest keeps rising. Shorts are paying; I am curious whether anyone tracks this as a squeeze risk.',
    market: 'futures',
    coins: ['ETH', 'SOL'],
    media: [
      {
        kind: 'IMAGE',
        url: still(2),
        thumbnailUrl: null,
        width: 1200,
        height: 675,
        durationSeconds: null,
      },
      {
        kind: 'IMAGE',
        url: still(3),
        thumbnailUrl: null,
        width: 1200,
        height: 675,
        durationSeconds: null,
      },
    ],
    minutesAgo: 60 * 26,
    likedBy: ['dev-member-1'],
  },
  {
    id: 'dev-post-4',
    authorId: 'dev-member-1',
    title: 'A short walk through my journal review',
    content:
      'A short video of how I review last week: plan, outcome, and the one mistake I repeat.',
    market: null,
    coins: [],
    media: [
      {
        kind: 'VIDEO',
        url: 'about:blank',
        thumbnailUrl: still(4),
        width: 1280,
        height: 720,
        durationSeconds: 95,
      },
    ],
    minutesAgo: 60 * 24 * 3,
    likedBy: ['dev-member-2', 'dev-member-3'],
  },
  {
    id: 'dev-post-mine-1',
    authorId: 'me',
    title: 'My first plan with a fixed risk per trade',
    content:
      'Trying a 1% risk per plan this month. Feedback on the stop placement welcome.',
    market: 'spot',
    coins: ['ETH'],
    minutesAgo: 60 * 8,
    likedBy: ['dev-member-1'],
  },
  {
    id: 'dev-post-mine-hidden',
    authorId: 'me',
    title: 'Hidden after a report (only you see it)',
    content:
      'An administrator hid this post after a report; it stays in My posts.',
    market: null,
    coins: [],
    hidden: true,
    minutesAgo: 60 * 24 * 9,
    likedBy: [],
  },
];

export interface DevCommentSeed {
  id: string;
  postId: string;
  parentId: string | null;
  authorId: string;
  content: string;
  deleted?: boolean;
  minutesAgo: number;
  likedBy: readonly string[];
}

export const devCommentSeeds: readonly DevCommentSeed[] = [
  {
    id: 'dev-comment-1',
    postId: 'dev-post-1',
    parentId: null,
    authorId: 'dev-member-2',
    content: 'I watch whether the retest candle closes back above the level.',
    minutesAgo: 40,
    likedBy: ['me'],
  },
  {
    id: 'dev-comment-2',
    postId: 'dev-post-1',
    parentId: 'dev-comment-1',
    authorId: 'dev-member-1',
    content: 'Same here, and the volume of that close.',
    minutesAgo: 35,
    likedBy: [],
  },
  {
    id: 'dev-comment-3',
    postId: 'dev-post-1',
    parentId: null,
    authorId: 'dev-member-3',
    content: 'Removed by its author.',
    deleted: true,
    minutesAgo: 30,
    likedBy: [],
  },
  {
    id: 'dev-comment-4',
    postId: 'dev-post-1',
    parentId: 'dev-comment-3',
    authorId: 'me',
    content: 'Replying to a comment that was deleted later.',
    minutesAgo: 25,
    likedBy: ['dev-member-2'],
  },
  {
    id: 'dev-comment-5',
    postId: 'dev-post-3',
    parentId: null,
    authorId: 'dev-member-1',
    content: 'Open interest rising with negative funding is worth a note.',
    minutesAgo: 60 * 20,
    likedBy: [],
  },
];

/** Posts the signed-in Trader already reported (BR-46). */
export const devReportedPostIds: readonly string[] = ['dev-post-3'];
