import type {
  CoinDiscussion,
  CommentPage,
  Engagement,
  MemberProfile,
  OfficialCategory,
  PostAuthor,
  PostComment,
  PostDetail,
  PostDraft,
  PostMedia,
  PostMediaKind,
  PostPage,
  PostStatus,
  PostSummary,
  PostType,
} from '../../types/domain';
import {
  flag,
  instant,
  integer,
  list,
  nullableInstant,
  nullableText,
  oneOf,
  record,
  text,
} from './decode';
import { marketOf } from './market-dto';

/**
 * Decoders for `/posts/**`, `/comments/**`, `/media/upload-signature` and
 * `/community/members/*` (SRS 3.7, D-98, D-99), checked against the
 * backend community branch @ d43b90c: `PostSummaryResponse`,
 * `PostDetailResponse`, `MediaResponse`, `CommentResponse`,
 * `EngagementResponse`, `UploadSignatureResponse`,
 * `CoinDiscussionResponse`, `MemberProfileResponse`, `PostRequest`.
 */
const STATUSES: readonly PostStatus[] = ['PUBLISHED', 'HIDDEN', 'DELETED'];
const TYPES: readonly PostType[] = ['TEXT', 'VIDEO'];
const KINDS: readonly PostMediaKind[] = ['IMAGE', 'VIDEO'];
const CATEGORIES: readonly OfficialCategory[] = [
  'ANNOUNCEMENT',
  'PLATFORM_UPDATE',
  'EDUCATION',
];

function nullableInteger(value: unknown, name: string): number | null {
  return value === null || value === undefined ? null : integer(value, name);
}
function count(value: unknown, name: string): number {
  const n = integer(value, name);
  if (n < 0) throw new Error(name + ' must not be negative');
  return n;
}
/** Text the backend may send empty (an excerpt of a post with no text). */
function anyText(value: unknown, name: string): string {
  if (typeof value !== 'string') throw new Error(name + ' must be a string');
  return value;
}

function decodeAuthor(body: unknown): PostAuthor {
  const value = record(body, 'author');
  return {
    userId: text(value.userId, 'author.userId'),
    displayName: nullableText(value.displayName, 'author.displayName'),
    avatarUrl: nullableText(value.avatarUrl, 'author.avatarUrl'),
  };
}

export function decodeMedia(body: unknown): PostMedia {
  const value = record(body, 'media');
  return {
    publicId: text(value.publicId, 'publicId'),
    kind: oneOf(KINDS, value.mediaType, 'mediaType'),
    url: text(value.url, 'url'),
    thumbnailUrl: nullableText(value.thumbnailUrl, 'thumbnailUrl'),
    width: nullableInteger(value.width, 'width'),
    height: nullableInteger(value.height, 'height'),
    durationSeconds: nullableInteger(value.durationSeconds, 'durationSeconds'),
  };
}

function decodeBase(value: Record<string, unknown>) {
  const market = value.marketType;
  const category = value.officialCategory;
  return {
    id: text(value.id, 'id'),
    author: decodeAuthor(value.author),
    title: text(value.title, 'title'),
    postType: oneOf(TYPES, value.postType, 'postType'),
    market: market === null || market === undefined ? null : marketOf(market),
    official: flag(value.official, 'official'),
    officialCategory:
      category === null || category === undefined
        ? null
        : oneOf(CATEGORIES, category, 'officialCategory'),
    status: oneOf(STATUSES, value.status, 'status'),
    coins: list(value.coins, 'coins').map((coin) => text(coin, 'coin')),
    likeCount: count(value.likeCount, 'likeCount'),
    commentCount: count(value.commentCount, 'commentCount'),
    likedByMe: flag(value.likedByMe, 'likedByMe'),
    savedByMe: flag(value.savedByMe, 'savedByMe'),
    createdAt: instant(value.createdAt, 'createdAt'),
    updatedAt: instant(value.updatedAt, 'updatedAt'),
  };
}

export function decodePostSummary(body: unknown): PostSummary {
  const value = record(body, 'post');
  return {
    ...decodeBase(value),
    excerpt: anyText(value.excerpt, 'excerpt'),
    cover:
      value.cover === null || value.cover === undefined
        ? null
        : decodeMedia(value.cover),
  };
}

export function decodePostDetail(body: unknown): PostDetail {
  const value = record(body, 'post');
  return {
    ...decodeBase(value),
    content: text(value.content, 'content'),
    media: list(value.media, 'media').map(decodeMedia),
    mine: flag(value.mine, 'mine'),
  };
}

function page<T>(body: unknown, item: (value: unknown) => T) {
  const value = record(body);
  return {
    items: list(value.items, 'items').map(item),
    page: integer(value.page, 'page'),
    pageSize: integer(value.pageSize, 'pageSize'),
    total: count(value.total, 'total'),
  };
}

export function decodePostPage(body: unknown): PostPage {
  return page(body, decodePostSummary);
}

export function decodeComment(body: unknown): PostComment {
  const value = record(body, 'comment');
  const deleted = flag(value.deleted, 'deleted');
  return {
    id: text(value.id, 'id'),
    postId: text(value.postId, 'postId'),
    parentCommentId: nullableText(value.parentCommentId, 'parentCommentId'),
    author:
      value.author === null || value.author === undefined
        ? null
        : decodeAuthor(value.author),
    content: deleted ? null : nullableText(value.content, 'content'),
    deleted,
    likeCount: count(value.likeCount, 'likeCount'),
    likedByMe: flag(value.likedByMe, 'likedByMe'),
    mine: flag(value.mine, 'mine'),
    createdAt: instant(value.createdAt, 'createdAt'),
    updatedAt: instant(value.updatedAt, 'updatedAt'),
    replies: list(value.replies ?? [], 'replies').map(decodeComment),
  };
}

export function decodeCommentPage(body: unknown): CommentPage {
  return page(body, decodeComment);
}

export function decodeEngagement(body: unknown): Engagement {
  const value = record(body);
  return {
    active: flag(value.active, 'active'),
    count: count(value.count, 'count'),
  };
}

export function decodeCoinDiscussion(body: unknown): CoinDiscussion {
  const value = record(body);
  return {
    symbol: text(value.symbol, 'symbol'),
    name: text(value.name, 'name'),
    postsLastDay: count(value.postsLastDay, 'postsLastDay'),
    postsLastWeek: count(value.postsLastWeek, 'postsLastWeek'),
    totalPosts: count(value.totalPosts, 'totalPosts'),
    lastPostAt: nullableInstant(value.lastPostAt, 'lastPostAt'),
  };
}

export function decodeMember(body: unknown): MemberProfile {
  const value = record(body);
  return {
    userId: text(value.userId, 'userId'),
    displayName: text(value.displayName, 'displayName'),
    avatarUrl: nullableText(value.avatarUrl, 'avatarUrl'),
    joinedAt: instant(value.joinedAt, 'joinedAt'),
    posts: count(value.posts, 'posts'),
    likesReceived: count(value.likesReceived, 'likesReceived'),
    me: flag(value.me, 'me'),
  };
}

/** The signed form of one file (D-98); the fields go to the storage as is. */
export interface UploadForm {
  uploadUrl: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  publicId: string;
  allowedFormats: readonly string[];
  /** Sent as `overwrite`; the storage refuses the signature without it. */
  overwrite: boolean;
  kind: PostMediaKind;
  maxBytes: number;
  maxDurationSeconds: number | null;
}

export function decodeUploadForm(body: unknown): UploadForm {
  const value = record(body);
  const uploadUrl = text(value.uploadUrl, 'uploadUrl');
  if (new URL(uploadUrl).protocol !== 'https:')
    throw new Error('uploadUrl must be https');
  return {
    uploadUrl,
    apiKey: text(value.apiKey, 'apiKey'),
    timestamp: integer(value.timestamp, 'timestamp'),
    signature: text(value.signature, 'signature'),
    publicId: text(value.publicId, 'publicId'),
    allowedFormats: list(value.allowedFormats, 'allowedFormats').map((f) =>
      text(f, 'allowedFormat').toLowerCase(),
    ),
    overwrite: flag(value.overwrite, 'overwrite'),
    kind: oneOf(KINDS, value.mediaType, 'mediaType'),
    maxBytes: count(value.maxBytes, 'maxBytes'),
    maxDurationSeconds: nullableInteger(
      value.maxDurationSeconds,
      'maxDurationSeconds',
    ),
  };
}

/** The body of `POST /posts` and `PUT /posts/{id}` (`PostRequest`). */
export function encodePostDraft(draft: PostDraft) {
  return {
    title: draft.title,
    content: draft.content,
    marketType: draft.market ? draft.market.toUpperCase() : null,
    coins: draft.coins,
    media: draft.media.map((item) => ({
      publicId: item.publicId,
      mediaType: item.kind,
    })),
  };
}
