import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  checkFile,
  createHttpCommunityService,
  createPendingCommunityService,
  fileFormat,
  sizeLimit,
} from './community';
import {
  decodeComment,
  decodePostDetail,
  decodePostPage,
  decodeUploadForm,
  encodePostDraft,
} from './community-dto';
import { ServiceError } from './errors';
import { createHttpClient } from './http-client';

/** Shapes of the backend community branch @ d43b90c. */
const AUTHOR = {
  userId: '0199b000-0000-7000-8000-000000000001',
  displayName: 'Lan Pham',
  avatarUrl: null,
};
const IMAGE = {
  publicId: 'cryptopilot/posts/u1/a1',
  mediaType: 'IMAGE',
  url: 'https://res.example.test/a1.jpg',
  thumbnailUrl: null,
  width: 1200,
  height: 800,
  durationSeconds: null,
};
const SUMMARY = {
  id: '0199b100-0000-7000-8000-000000000001',
  author: AUTHOR,
  title: 'BTC holds the weekly support',
  excerpt: 'Price came back to the level twice…',
  postType: 'TEXT',
  marketType: 'SPOT',
  official: false,
  officialCategory: null,
  status: 'PUBLISHED',
  coins: ['BTC'],
  cover: IMAGE,
  likeCount: 4,
  commentCount: 2,
  likedByMe: false,
  savedByMe: true,
  createdAt: '2026-10-21T08:00:00Z',
  updatedAt: '2026-10-21T08:00:00Z',
};
const BASE = Object.fromEntries(
  Object.entries(SUMMARY).filter(
    ([key]) => key !== 'excerpt' && key !== 'cover',
  ),
);
const DETAIL = {
  ...BASE,
  content: 'Price came back to the level twice this week.',
  media: [IMAGE],
  mine: true,
};
const REPLY = {
  id: '0199b200-0000-7000-8000-000000000002',
  postId: SUMMARY.id,
  parentCommentId: '0199b200-0000-7000-8000-000000000001',
  author: AUTHOR,
  content: 'Agreed.',
  deleted: false,
  likeCount: 0,
  likedByMe: false,
  mine: false,
  createdAt: '2026-10-21T09:00:00Z',
  updatedAt: '2026-10-21T09:00:00Z',
  replies: [],
};
const DELETED = {
  ...REPLY,
  id: '0199b200-0000-7000-8000-000000000001',
  parentCommentId: null,
  author: null,
  content: null,
  deleted: true,
  replies: [REPLY],
};
const FORM = {
  uploadUrl: 'https://upload.example.test/v1_1/demo/image/upload',
  apiKey: 'key-1',
  timestamp: 1_761_000_000,
  signature: 'sig-1',
  publicId: 'cryptopilot/posts/u1/new',
  allowedFormats: ['jpg', 'png', 'webp'],
  overwrite: false,
  mediaType: 'IMAGE',
  maxBytes: 5 * 1024 * 1024,
  maxDurationSeconds: null,
};

describe('community decoders', () => {
  it('decodes a feed page with its cover and market', () => {
    const page = decodePostPage({
      items: [SUMMARY],
      page: 1,
      pageSize: 20,
      total: 1,
    });
    expect(page.items[0]).toMatchObject({
      market: 'spot',
      cover: { kind: 'IMAGE', publicId: IMAGE.publicId },
      savedByMe: true,
    });
  });

  it('decodes a post with its media and ownership', () => {
    const post = decodePostDetail(DETAIL);
    expect(post.mine).toBe(true);
    expect(post.media).toHaveLength(1);
    expect(() => decodePostDetail({ ...DETAIL, status: 'GONE' })).toThrow();
  });

  it('keeps a deleted comment without text or author while it has replies', () => {
    const comment = decodeComment(DELETED);
    expect(comment).toMatchObject({
      deleted: true,
      author: null,
      content: null,
    });
    expect(comment.replies[0]?.content).toBe('Agreed.');
  });

  it('refuses an upload form that is not https', () => {
    expect(decodeUploadForm(FORM).allowedFormats).toEqual([
      'jpg',
      'png',
      'webp',
    ]);
    expect(() =>
      decodeUploadForm({ ...FORM, uploadUrl: 'http://upload.example.test/x' }),
    ).toThrow();
  });

  it('refuses an upload form without its signed overwrite field', () => {
    expect(decodeUploadForm(FORM).overwrite).toBe(false);
    expect(() => decodeUploadForm({ ...FORM, overwrite: undefined })).toThrow();
  });

  it('encodes a draft as PostRequest', () => {
    expect(
      encodePostDraft({
        title: 'Title here',
        content: 'Body',
        market: 'futures',
        coins: ['BTC', 'ETH'],
        media: [{ publicId: 'k1', kind: 'IMAGE' }],
      }),
    ).toEqual({
      title: 'Title here',
      content: 'Body',
      marketType: 'FUTURES',
      coins: ['BTC', 'ETH'],
      media: [{ publicId: 'k1', mediaType: 'IMAGE' }],
    });
  });
});

describe('media checks before an upload (BR-44)', () => {
  const form = decodeUploadForm(FORM);

  it('names formats as the storage does', () => {
    expect(fileFormat({ name: 'a.JPEG', type: '' })).toBe('jpg');
    expect(fileFormat({ name: 'a.bin', type: 'image/png' })).toBe('png');
    expect(sizeLimit(5 * 1024 * 1024)).toBe('5 MB');
    expect(sizeLimit(1536 * 1024)).toBe('1.5 MB');
  });

  it('refuses a wrong format, an empty or a too large file with MSG32', () => {
    const refusal = (file: { name: string; type: string; size: number }) => {
      try {
        checkFile(file, form, null);
      } catch (error) {
        return error instanceof ServiceError ? error.problem : undefined;
      }
      return null;
    };
    expect(
      refusal({ name: 'a.gif', type: 'image/gif', size: 10 }),
    ).toMatchObject({
      code: 'MEDIA_INVALID',
      messageCode: 'MSG32',
      messageArgs: ['5 MB'],
    });
    expect(refusal({ name: 'a.png', type: 'image/png', size: 0 })).toBeTruthy();
    expect(
      refusal({ name: 'a.png', type: 'image/png', size: form.maxBytes + 1 }),
    ).toBeTruthy();
    expect(refusal({ name: 'a.png', type: 'image/png', size: 10 })).toBeNull();
  });

  it('refuses a video longer than its form allows', () => {
    const video = decodeUploadForm({
      ...FORM,
      mediaType: 'VIDEO',
      allowedFormats: ['mp4', 'webm'],
      maxDurationSeconds: 300,
    });
    const file = { name: 'v.mp4', type: 'video/mp4', size: 10 };
    expect(() => checkFile(file, video, 301)).toThrow(ServiceError);
    expect(() => checkFile(file, video, 300)).not.toThrow();
    expect(() => checkFile(file, video, null)).not.toThrow();
  });
});

function setup(reply: unknown, status = 200) {
  const calls: { url: URL; method: string; body: unknown }[] = [];
  const http = createHttpClient({
    baseUrl: 'https://api.example.test/api/v1',
    fetcher: vi.fn<typeof fetch>(async (input, init = {}) => {
      calls.push({
        url: new URL(String(input)),
        method: init.method ?? 'GET',
        body: init.body ? JSON.parse(String(init.body)) : undefined,
      });
      return status === 204
        ? new Response(null, { status })
        : new Response(JSON.stringify(reply), { status });
    }),
    session: { accessToken: () => null, refresh: async () => 'ended' },
  });
  return { community: createHttpCommunityService(http), calls };
}

describe('HTTP community adapter', () => {
  it('reads a feed tab with its filters, leaving out the empty ones', async () => {
    const { community, calls } = setup({
      items: [],
      page: 2,
      pageSize: 20,
      total: 0,
    });
    await community.feed({
      tab: 'MOST_LIKED',
      coin: 'BTC',
      market: 'spot',
      q: '',
      page: 2,
      pageSize: 20,
    });
    expect(calls[0]?.url.pathname).toBe('/api/v1/posts');
    expect(Object.fromEntries(calls[0]?.url.searchParams ?? [])).toEqual({
      tab: 'MOST_LIKED',
      coin: 'BTC',
      market: 'SPOT',
      page: '2',
      pageSize: '20',
    });
  });

  it('likes and saves posts and likes comments as toggles (BR-45)', async () => {
    const { community, calls } = setup({ active: true, count: 5 });
    await community.react({ kind: 'post', id: 'p1', action: 'save' }, true);
    await community.react({ kind: 'comment', id: 'c1', action: 'like' }, false);
    expect(calls.map((c) => c.method + ' ' + c.url.pathname)).toEqual([
      'POST /api/v1/posts/p1/save',
      'DELETE /api/v1/comments/c1/like',
    ]);
  });

  it('comments, replies and reports with the backend bodies', async () => {
    const { community, calls } = setup(REPLY, 201);
    await community.comment('p1', 'Agreed.', 'c1');
    expect(calls[0]).toMatchObject({
      method: 'POST',
      body: { content: 'Agreed.', parentCommentId: 'c1' },
    });
    await community.report('p1', { reason: 'OTHER', description: 'Fake' });
    expect(calls[1]?.url.pathname).toBe('/api/v1/posts/p1/reports');
    expect(calls[1]?.body).toEqual({ reason: 'OTHER', description: 'Fake' });
  });

  it('keeps the code of a repeated report (Q-66)', async () => {
    const { community } = setup(
      {
        status: 409,
        code: 'POST_ALREADY_REPORTED',
        messageCode: 'MSG34',
        messageArgs: [],
      },
      409,
    );
    const error = await community
      .report('p1', { reason: 'SPAM', description: null })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ServiceError);
    expect((error as ServiceError).problem?.code).toBe('POST_ALREADY_REPORTED');
  });

  it('reads a member page and a coin discussion', async () => {
    const member = setup({
      userId: AUTHOR.userId,
      displayName: 'Lan Pham',
      avatarUrl: null,
      joinedAt: '2026-09-01T00:00:00Z',
      posts: 3,
      likesReceived: 10,
      me: false,
    });
    await member.community.member(AUTHOR.userId);
    expect(member.calls[0]?.url.pathname).toBe(
      '/api/v1/community/members/' + AUTHOR.userId,
    );
    const coin = setup({
      symbol: 'BTC',
      name: 'Bitcoin',
      postsLastDay: 1,
      postsLastWeek: 4,
      totalPosts: 9,
      lastPostAt: null,
    });
    expect((await coin.community.coinDiscussion('BTC')).postsLastWeek).toBe(4);
    expect(coin.calls[0]?.url.pathname).toBe(
      '/api/v1/posts/coins/BTC/discussion',
    );
  });
});

describe('upload to the media storage (D-98)', () => {
  afterEach(() => vi.unstubAllGlobals());

  function stubStorage(status: number) {
    const sent: { url: string; fields: Record<string, string> }[] = [];
    class FakeRequest {
      upload: { onprogress: ((e: ProgressEvent) => void) | null } = {
        onprogress: null,
      };
      status = 0;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      onabort: (() => void) | null = null;
      private url = '';
      open(_method: string, url: string) {
        this.url = url;
      }
      abort() {
        this.onabort?.();
      }
      send(body: FormData) {
        const fields: Record<string, string> = {};
        body.forEach((value, key) => {
          if (typeof value === 'string') fields[key] = value;
        });
        sent.push({ url: this.url, fields });
        this.upload.onprogress?.({
          lengthComputable: true,
          loaded: 1,
          total: 2,
        } as ProgressEvent);
        this.status = status;
        this.onload?.();
      }
    }
    vi.stubGlobal('XMLHttpRequest', FakeRequest);
    return sent;
  }

  it('signs, sends the signed fields and returns the key', async () => {
    const sent = stubStorage(200);
    const { community, calls } = setup(FORM);
    const progress: number[] = [];
    const file = new File(['x'], 'chart.png', { type: 'image/png' });
    const ref = await community.upload(file, 'IMAGE', (p) => progress.push(p));
    expect(calls[0]).toMatchObject({
      method: 'POST',
      body: { mediaType: 'IMAGE' },
    });
    expect(sent[0]).toEqual({
      url: FORM.uploadUrl,
      fields: {
        api_key: 'key-1',
        timestamp: String(FORM.timestamp),
        signature: 'sig-1',
        public_id: FORM.publicId,
        allowed_formats: 'jpg,png,webp',
        overwrite: 'false',
      },
    });
    expect(progress).toEqual([0.5, 1]);
    expect(ref).toEqual({ publicId: FORM.publicId, kind: 'IMAGE' });
  });

  it('turns a storage refusal into MSG32 and never uploads a bad file', async () => {
    const sent = stubStorage(400);
    const { community } = setup(FORM);
    const ok = new File(['x'], 'chart.png', { type: 'image/png' });
    await expect(community.upload(ok, 'IMAGE')).rejects.toMatchObject({
      problem: { messageCode: 'MSG32' },
    });
    const gif = new File(['x'], 'a.gif', { type: 'image/gif' });
    await expect(community.upload(gif, 'IMAGE')).rejects.toBeInstanceOf(
      ServiceError,
    );
    expect(sent).toHaveLength(1);
  });
});

describe('pending community adapter', () => {
  it('answers NOT_CONFIGURED while no API is configured', async () => {
    await expect(
      createPendingCommunityService().feed({
        tab: 'LATEST',
        page: 1,
        pageSize: 20,
      }),
    ).rejects.toMatchObject({ code: 'NOT_CONFIGURED' });
  });
});
