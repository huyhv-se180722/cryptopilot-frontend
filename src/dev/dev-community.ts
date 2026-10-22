import type { CommunityService } from '../services/api/contracts';
import { checkFile } from '../services/api/community';
import type { UploadForm } from '../services/api/community-dto';
import { ServiceError } from '../services/api/errors';
import type {
  CommentPage,
  FeedQuery,
  MarketType,
  OfficialCategory,
  PostAuthor,
  PostComment,
  PostDetail,
  PostDraft,
  PostMedia,
  PostMediaKind,
  PostSummary,
  Session,
} from '../types/domain';
import { devPairs } from './fixtures/market';
import {
  DEV_ADMIN_AUTHOR,
  devCommentSeeds,
  devMembers,
  devPostSeeds,
  devReportedPostIds,
} from './fixtures/community';

/**
 * DEVELOPMENT ONLY. In-memory community with the backend's answers: the
 * feed tabs (official posts only in the pinned list, MOST_LIKED over 7
 * days, SAVED and MINE a Trader's own, MSG44 for a Guest), search of 2–100
 * characters (MSG15), the PostRequest checks (MSG01 per field, coins a
 * listed pair trades), BR-44 media (MSG32), `VIDEO_POST` (MSG29), one like
 * and one save per Trader (BR-45), one report per post and none on an own
 * post (BR-46: POST_ALREADY_REPORTED, POST_REPORT_OWN_POST), deleted
 * comments kept while they have replies, and MSG41 for what the caller may
 * not see. Uploads stay in the browser (object URLs). A reload restores
 * the fixture.
 */
function refuse(
  status: number,
  code: string,
  messageCode: string,
  fieldErrors: Readonly<Record<string, string>> = {},
  messageArgs: readonly string[] = [],
): never {
  throw new ServiceError(
    'Development community refusal.',
    'HTTP_ERROR',
    status,
    {
      status,
      code,
      messageCode,
      messageArgs,
      fieldErrors,
    },
  );
}
const notFound = () => refuse(404, 'RESOURCE_NOT_FOUND', 'MSG41');
const signInRequired = () => refuse(401, 'AUTHENTICATION_REQUIRED', 'MSG44');

const pause = (signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, 200);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(signal.reason);
    });
  });

const MINUTE = 60_000;
const ME = 'me';
const GUEST_SELF: PostAuthor = {
  userId: 'dev-member-me',
  displayName: 'Dev Trader (fixture)',
  avatarUrl: null,
};

interface StoredPost {
  id: string;
  authorId: string;
  title: string;
  content: string;
  market: MarketType | null;
  coins: string[];
  official: OfficialCategory | null;
  status: 'PUBLISHED' | 'HIDDEN' | 'DELETED';
  media: PostMedia[];
  createdAt: number;
  updatedAt: number;
  likes: Set<string>;
  saves: Set<string>;
}
interface StoredComment {
  id: string;
  postId: string;
  parentId: string | null;
  authorId: string;
  content: string;
  deleted: boolean;
  createdAt: number;
  updatedAt: number;
  likes: Set<string>;
}

const IMAGE_FORM: UploadForm = {
  uploadUrl: 'https://upload.invalid/dev',
  apiKey: 'dev',
  timestamp: 0,
  signature: 'dev',
  publicId: '',
  allowedFormats: ['jpg', 'png', 'webp'],
  kind: 'IMAGE',
  maxBytes: 5 * 1024 * 1024,
  maxDurationSeconds: null,
};
const VIDEO_FORM: UploadForm = {
  ...IMAGE_FORM,
  allowedFormats: ['mp4', 'webm'],
  kind: 'VIDEO',
  maxBytes: 100 * 1024 * 1024,
  maxDurationSeconds: 300,
};
const MAX_IMAGES = 4;

export function createDevelopmentCommunity(
  session: () => Promise<Session | null>,
): { community: CommunityService } {
  const built = Date.now();
  const posts = new Map<string, StoredPost>(
    devPostSeeds.map((seed) => [
      seed.id,
      {
        id: seed.id,
        authorId: seed.authorId,
        title: seed.title,
        content: seed.content,
        market: seed.market,
        coins: [...seed.coins],
        official: seed.official ?? null,
        status: seed.hidden ? 'HIDDEN' : 'PUBLISHED',
        media: (seed.media ?? []).map((m, i) => ({
          ...m,
          publicId: seed.id + '/media-' + String(i),
        })),
        createdAt: built - seed.minutesAgo * MINUTE,
        updatedAt: built - seed.minutesAgo * MINUTE,
        likes: new Set(seed.likedBy),
        saves: new Set(seed.savedByMe ? [ME] : []),
      },
    ]),
  );
  const comments = new Map<string, StoredComment>(
    devCommentSeeds.map((seed) => [
      seed.id,
      {
        id: seed.id,
        postId: seed.postId,
        parentId: seed.parentId,
        authorId: seed.authorId,
        content: seed.content,
        deleted: seed.deleted ?? false,
        createdAt: built - seed.minutesAgo * MINUTE,
        updatedAt: built - seed.minutesAgo * MINUTE,
        likes: new Set(seed.likedBy),
      },
    ]),
  );
  const reported = new Set(devReportedPostIds);
  const uploads = new Map<string, PostMedia>();
  let sequence = 0;
  const nextId = (prefix: string) => `${prefix}-${String(++sequence)}`;

  /** 'me' when a Trader is signed in, null for a Guest. */
  async function caller(): Promise<{ key: string; session: Session } | null> {
    const current = await session();
    return current && current.user.role === 'Trader'
      ? { key: ME, session: current }
      : null;
  }
  async function trader() {
    return (await caller()) ?? signInRequired();
  }

  function authorOf(id: string, me: Session | null): PostAuthor {
    if (id === ME)
      return me
        ? {
            userId: me.user.id,
            displayName: me.user.displayName,
            avatarUrl: null,
          }
        : GUEST_SELF;
    if (id === DEV_ADMIN_AUTHOR.userId) return DEV_ADMIN_AUTHOR;
    const member = devMembers.find((m) => m.userId === id);
    return member
      ? {
          userId: member.userId,
          displayName: member.displayName,
          avatarUrl: member.avatarUrl,
        }
      : { userId: id, displayName: null, avatarUrl: null };
  }
  /** The stored author key of a member id as the client names it. */
  function authorKey(id: string, me: Session | null) {
    if (me && id === me.user.id) return ME;
    if (id === GUEST_SELF.userId) return ME;
    return id;
  }

  const visible = (post: StoredPost, key: string | null) =>
    post.status === 'PUBLISHED' ||
    (post.status === 'HIDDEN' && key !== null && post.authorId === key);
  const publishedComments = (postId: string) =>
    [...comments.values()].filter((c) => c.postId === postId && !c.deleted)
      .length;

  function base(post: StoredPost, key: string | null, me: Session | null) {
    return {
      id: post.id,
      author: authorOf(post.authorId, me),
      title: post.title,
      postType: post.media.some((m) => m.kind === 'VIDEO')
        ? ('VIDEO' as const)
        : ('TEXT' as const),
      market: post.market,
      official: post.official !== null,
      officialCategory: post.official,
      status: post.status,
      coins: [...post.coins].sort(),
      likeCount: post.likes.size,
      commentCount: publishedComments(post.id),
      likedByMe: key !== null && post.likes.has(key),
      savedByMe: key !== null && post.saves.has(key),
      createdAt: new Date(post.createdAt).toISOString(),
      updatedAt: new Date(post.updatedAt).toISOString(),
    };
  }
  function summary(
    post: StoredPost,
    key: string | null,
    me: Session | null,
  ): PostSummary {
    return {
      ...base(post, key, me),
      excerpt: post.content.slice(0, 300),
      cover: post.media[0] ?? null,
    };
  }
  function detail(
    post: StoredPost,
    key: string | null,
    me: Session | null,
  ): PostDetail {
    return {
      ...base(post, key, me),
      content: post.content,
      media: [...post.media],
      mine: key !== null && post.authorId === key,
    };
  }
  function page<T>(all: readonly T[], pageNo: number, pageSize: number) {
    if (pageNo < 1)
      refuse(400, 'VALIDATION_FAILED', 'MSG01', { page: 'MSG15' });
    if (pageSize < 1 || pageSize > 100)
      refuse(400, 'VALIDATION_FAILED', 'MSG01', { pageSize: 'MSG15' });
    const start = (pageNo - 1) * pageSize;
    return {
      items: all.slice(start, start + pageSize),
      page: pageNo,
      pageSize,
      total: all.length,
    };
  }

  function feedPosts(q: FeedQuery, key: string | null, me: Session | null) {
    const now = Date.now();
    let found = [...posts.values()];
    switch (q.tab) {
      case 'LATEST':
        found = found.filter((p) => p.status === 'PUBLISHED' && !p.official);
        found.sort((a, b) => b.createdAt - a.createdAt);
        break;
      case 'MOST_LIKED':
        found = found.filter(
          (p) =>
            p.status === 'PUBLISHED' &&
            !p.official &&
            p.createdAt >= now - 7 * 24 * 60 * MINUTE,
        );
        found.sort(
          (a, b) => b.likes.size - a.likes.size || b.createdAt - a.createdAt,
        );
        break;
      case 'SAVED':
        found = found.filter((p) => key && p.saves.has(key) && visible(p, key));
        break;
      case 'MINE':
        found = found.filter((p) => p.authorId === key && visible(p, key));
        found.sort((a, b) => b.createdAt - a.createdAt);
        break;
    }
    const coin = q.coin?.toUpperCase();
    if (coin) found = found.filter((p) => p.coins.includes(coin));
    if (q.market) found = found.filter((p) => p.market === q.market);
    if (q.author) {
      const author = authorKey(q.author, me);
      found = found.filter((p) => p.authorId === author);
    }
    if (q.q) {
      const text = q.q.toLowerCase();
      found = found.filter(
        (p) =>
          p.title.toLowerCase().includes(text) ||
          p.content.toLowerCase().includes(text),
      );
    }
    return found;
  }

  function listedCoins() {
    const coins = new Set<string>();
    for (const market of ['spot', 'futures'] as const)
      for (const pair of devPairs(market)) {
        if (pair.baseAsset) coins.add(pair.baseAsset);
        if (pair.quoteAsset) coins.add(pair.quoteAsset);
      }
    return coins;
  }

  function checkDraft(draft: PostDraft, me: Session, keep: PostMedia[]) {
    const errors: Record<string, string> = {};
    const title = draft.title.trim();
    const content = draft.content.trim();
    if (title.length < 5 || title.length > 150) errors.title = 'MSG01';
    if (content.length < 1 || content.length > 10_000) errors.content = 'MSG01';
    const coins = [...new Set(draft.coins.map((c) => c.trim().toUpperCase()))];
    const listed = listedCoins();
    if (coins.length > 5 || coins.some((c) => !listed.has(c)))
      errors.coins = 'MSG01';
    if (Object.keys(errors).length > 0)
      refuse(400, 'VALIDATION_FAILED', 'MSG01', errors);
    const media = draft.media.map(
      (ref) =>
        uploads.get(ref.publicId) ??
        keep.find((m) => m.publicId === ref.publicId) ??
        refuse(400, 'MEDIA_INVALID', 'MSG32', {}, ['5 MB']),
    );
    const videos = media.filter((m) => m.kind === 'VIDEO').length;
    if (
      (videos > 0 && media.length > 1) ||
      media.length > MAX_IMAGES ||
      media.some((m, i) => m.kind !== draft.media[i]?.kind)
    )
      refuse(400, 'MEDIA_INVALID', 'MSG32', {}, ['5 MB']);
    const newVideo = media.some(
      (m) => m.kind === 'VIDEO' && !keep.some((k) => k.publicId === m.publicId),
    );
    if (newVideo && !canPostVideo(me))
      refuse(403, 'PLAN_FEATURE_NOT_INCLUDED', 'MSG29', {}, ['PRO']);
    return { title, content, coins, media };
  }
  const canPostVideo = (me: Session) =>
    me.entitlements !== 'unknown' &&
    me.entitlements.features.includes('VIDEO_POST');

  function ownPost(id: string, key: string) {
    const post = posts.get(id);
    if (!post || post.status === 'DELETED' || post.authorId !== key)
      return notFound();
    return post;
  }
  function seenPost(id: string, key: string | null) {
    const post = posts.get(id);
    if (!post || !visible(post, key)) return notFound();
    return post;
  }

  function commentOf(
    c: StoredComment,
    key: string | null,
    me: Session | null,
  ): PostComment {
    const replies =
      c.parentId === null
        ? [...comments.values()]
            .filter((r) => r.parentId === c.id && !r.deleted)
            .sort((a, b) => a.createdAt - b.createdAt)
            .map((r) => commentOf(r, key, me))
        : [];
    return {
      id: c.id,
      postId: c.postId,
      parentCommentId: c.parentId,
      author: c.deleted ? null : authorOf(c.authorId, me),
      content: c.deleted ? null : c.content,
      deleted: c.deleted,
      likeCount: c.likes.size,
      likedByMe: key !== null && c.likes.has(key),
      mine: key !== null && c.authorId === key && !c.deleted,
      createdAt: new Date(c.createdAt).toISOString(),
      updatedAt: new Date(c.updatedAt).toISOString(),
      replies,
    };
  }
  function checkComment(content: string) {
    const text = content.trim();
    if (text.length < 1 || text.length > 2_000)
      refuse(400, 'VALIDATION_FAILED', 'MSG01', { content: 'MSG01' });
    return text;
  }

  const community: CommunityService = {
    async feed(q, signal) {
      await pause(signal);
      const who = await caller();
      if (!who && (q.tab === 'SAVED' || q.tab === 'MINE')) signInRequired();
      const text = q.q?.trim();
      if (
        text !== undefined &&
        text !== '' &&
        (text.length < 2 || text.length > 100)
      )
        refuse(400, 'VALIDATION_FAILED', 'MSG01', { q: 'MSG15' });
      const me = who?.session ?? null;
      const key = who?.key ?? null;
      const found = feedPosts({ ...q, ...(text ? { q: text } : {}) }, key, me);
      const result = page(found, q.page, q.pageSize);
      return { ...result, items: result.items.map((p) => summary(p, key, me)) };
    },
    async pinned(q, signal) {
      await pause(signal);
      const who = await caller();
      const found = [...posts.values()]
        .filter(
          (p) =>
            p.official !== null &&
            p.status === 'PUBLISHED' &&
            (!q.category || p.official === q.category),
        )
        .sort((a, b) => b.createdAt - a.createdAt);
      const result = page(found, q.page, q.pageSize);
      return {
        ...result,
        items: result.items.map((p) =>
          summary(p, who?.key ?? null, who?.session ?? null),
        ),
      };
    },
    async coinDiscussion(symbol, signal) {
      await pause(signal);
      const coin = symbol.toUpperCase();
      const pair = devPairs('spot').find((p) => p.baseAsset === coin);
      if (!pair) return notFound();
      const now = Date.now();
      const tagged = [...posts.values()].filter(
        (p) => p.status === 'PUBLISHED' && p.coins.includes(coin),
      );
      const last = Math.max(...tagged.map((p) => p.createdAt));
      return {
        symbol: coin,
        name: pair.baseAssetName ?? coin,
        postsLastDay: tagged.filter((p) => p.createdAt >= now - 1440 * MINUTE)
          .length,
        postsLastWeek: tagged.filter(
          (p) => p.createdAt >= now - 7 * 1440 * MINUTE,
        ).length,
        totalPosts: tagged.length,
        lastPostAt: tagged.length ? new Date(last).toISOString() : null,
      };
    },
    async post(id, signal) {
      await pause(signal);
      const who = await caller();
      const key = who?.key ?? null;
      return detail(seenPost(id, key), key, who?.session ?? null);
    },
    async create(draft) {
      await pause();
      const who = await trader();
      const checked = checkDraft(draft, who.session, []);
      const now = Date.now();
      const post: StoredPost = {
        id: nextId('dev-post-new'),
        authorId: ME,
        title: checked.title,
        content: checked.content,
        market: draft.market,
        coins: checked.coins,
        official: null,
        status: 'PUBLISHED',
        media: checked.media,
        createdAt: now,
        updatedAt: now,
        likes: new Set(),
        saves: new Set(),
      };
      posts.set(post.id, post);
      for (const m of checked.media) uploads.delete(m.publicId);
      return detail(post, ME, who.session);
    },
    async update(id, draft) {
      await pause();
      const who = await trader();
      const post = ownPost(id, ME);
      const checked = checkDraft(draft, who.session, post.media);
      Object.assign(post, {
        title: checked.title,
        content: checked.content,
        market: draft.market,
        coins: checked.coins,
        media: checked.media,
        updatedAt: Date.now(),
      });
      for (const m of checked.media) uploads.delete(m.publicId);
      return detail(post, ME, who.session);
    },
    async remove(id) {
      await pause();
      await trader();
      ownPost(id, ME).status = 'DELETED';
    },
    async react(target, active) {
      await pause();
      const who = await trader();
      if (target.kind === 'post') {
        const post = seenPost(target.id, who.key);
        const set = target.action === 'like' ? post.likes : post.saves;
        if (active) set.add(who.key);
        else set.delete(who.key);
        return { active, count: set.size };
      }
      const comment = comments.get(target.id);
      if (!comment || comment.deleted) return notFound();
      seenPost(comment.postId, who.key);
      if (active) comment.likes.add(who.key);
      else comment.likes.delete(who.key);
      return { active, count: comment.likes.size };
    },
    async comments(postId, pageNo, pageSize, signal): Promise<CommentPage> {
      await pause(signal);
      const who = await caller();
      const key = who?.key ?? null;
      seenPost(postId, key);
      const all = [...comments.values()];
      const threads = all
        .filter(
          (c) =>
            c.postId === postId &&
            c.parentId === null &&
            (!c.deleted || all.some((r) => r.parentId === c.id && !r.deleted)),
        )
        .sort((a, b) => a.createdAt - b.createdAt);
      const result = page(threads, pageNo, pageSize);
      return {
        ...result,
        items: result.items.map((c) => commentOf(c, key, who?.session ?? null)),
      };
    },
    async comment(postId, content, parentCommentId) {
      await pause();
      const who = await trader();
      seenPost(postId, who.key);
      const text = checkComment(content);
      let parentId: string | null = null;
      if (parentCommentId) {
        const parent = comments.get(parentCommentId);
        if (!parent || parent.deleted || parent.postId !== postId)
          return notFound();
        // One level only: a reply to a reply joins the thread (D-98).
        parentId = parent.parentId ?? parent.id;
      }
      const now = Date.now();
      const stored: StoredComment = {
        id: nextId('dev-comment-new'),
        postId,
        parentId,
        authorId: who.key,
        content: text,
        deleted: false,
        createdAt: now,
        updatedAt: now,
        likes: new Set(),
      };
      comments.set(stored.id, stored);
      return commentOf(stored, who.key, who.session);
    },
    async editComment(id, content) {
      await pause();
      const who = await trader();
      const stored = comments.get(id);
      if (!stored || stored.deleted || stored.authorId !== who.key)
        return notFound();
      stored.content = checkComment(content);
      stored.updatedAt = Date.now();
      return commentOf(stored, who.key, who.session);
    },
    async removeComment(id) {
      await pause();
      const who = await trader();
      const stored = comments.get(id);
      if (!stored || stored.deleted || stored.authorId !== who.key)
        return notFound();
      stored.deleted = true;
    },
    async report(postId, report) {
      await pause();
      const who = await trader();
      const post = seenPost(postId, who.key);
      const description = report.description?.trim() ?? '';
      if (report.reason === 'OTHER' && description === '')
        refuse(400, 'VALIDATION_FAILED', 'MSG01', { description: 'MSG01' });
      if (description.length > 500)
        refuse(400, 'VALIDATION_FAILED', 'MSG01', { description: 'MSG01' });
      if (post.authorId === who.key)
        refuse(409, 'POST_REPORT_OWN_POST', 'MSG43');
      if (reported.has(postId)) refuse(409, 'POST_ALREADY_REPORTED', 'MSG34');
      reported.add(postId);
    },
    async member(id, signal) {
      await pause(signal);
      const who = await caller();
      const me = who?.session ?? null;
      const key = authorKey(id, me);
      const known =
        key === ME ||
        key === DEV_ADMIN_AUTHOR.userId ||
        devMembers.some((m) => m.userId === key);
      if (!known) return notFound();
      const author = authorOf(key, me);
      const theirs = [...posts.values()].filter(
        (p) => p.authorId === key && p.status === 'PUBLISHED',
      );
      const joinedDaysAgo =
        devMembers.find((m) => m.userId === key)?.joinedDaysAgo ??
        (key === DEV_ADMIN_AUTHOR.userId ? DEV_ADMIN_AUTHOR.joinedDaysAgo : 30);
      return {
        userId: author.userId,
        displayName: author.displayName ?? author.userId,
        avatarUrl: author.avatarUrl,
        joinedAt: new Date(built - joinedDaysAgo * 1440 * MINUTE).toISOString(),
        posts: theirs.length,
        likesReceived: theirs.reduce((sum, p) => sum + p.likes.size, 0),
        me: key === ME && me !== null,
      };
    },
    async upload(file, kind: PostMediaKind, onProgress, signal) {
      const who = await trader();
      if (kind === 'VIDEO' && !canPostVideo(who.session))
        refuse(403, 'PLAN_FEATURE_NOT_INCLUDED', 'MSG29', {}, ['PRO']);
      const form = kind === 'VIDEO' ? VIDEO_FORM : IMAGE_FORM;
      checkFile(file, form, null);
      for (const share of [0.25, 0.5, 0.75]) {
        await pause(signal);
        onProgress?.(share);
      }
      onProgress?.(1);
      const publicId = nextId('dev-upload');
      const url = URL.createObjectURL(file);
      uploads.set(publicId, {
        publicId,
        kind,
        url,
        thumbnailUrl: null,
        width: null,
        height: null,
        durationSeconds: null,
      });
      return { publicId, kind };
    },
  };
  return { community };
}
