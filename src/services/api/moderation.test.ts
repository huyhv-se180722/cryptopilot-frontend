import { describe, expect, it, vi } from 'vitest';
import { createHttpClient } from './http-client';
import {
  createHttpModerationService,
  createPendingModerationService,
  decodeCase,
  decodeQueuePage,
  decodeResult,
} from './moderation';

/** Shapes of the backend community branch @ d43b90c. */
const AUTHOR = {
  userId: '0199b000-0000-7000-8000-000000000001',
  displayName: 'Lan Pham',
  avatarUrl: null,
};
const SUMMARY = {
  id: '0199b100-0000-7000-8000-000000000001',
  author: AUTHOR,
  title: 'Guaranteed 100x on a new token',
  excerpt: 'Send your wallet address…',
  postType: 'TEXT',
  marketType: null,
  official: false,
  officialCategory: null,
  status: 'PUBLISHED',
  coins: [],
  cover: null,
  likeCount: 0,
  commentCount: 0,
  likedByMe: false,
  savedByMe: false,
  createdAt: '2026-10-21T08:00:00Z',
  updatedAt: '2026-10-21T08:00:00Z',
};
const DETAIL = Object.fromEntries(
  Object.entries({
    ...SUMMARY,
    content: 'Send your wallet address to get the airdrop.',
    media: [],
    mine: false,
  }).filter(([key]) => key !== 'excerpt' && key !== 'cover'),
);
const REPORT = {
  id: '0199b300-0000-7000-8000-000000000001',
  reporter: { ...AUTHOR, userId: '0199b000-0000-7000-8000-000000000002' },
  reason: 'SCAM',
  description: null,
  status: 'REVIEWING',
  createdAt: '2026-10-21T09:00:00Z',
};

describe('moderation decoders', () => {
  it('decodes a queue row with its count and reasons', () => {
    const page = decodeQueuePage({
      items: [
        {
          post: SUMMARY,
          reportCount: 3,
          reasons: ['SCAM', 'SPAM'],
          firstReportedAt: '2026-10-21T09:00:00Z',
          lastReportedAt: '2026-10-22T01:00:00Z',
        },
      ],
      page: 1,
      pageSize: 20,
      total: 1,
    });
    expect(page.items[0]).toMatchObject({
      reportCount: 3,
      reasons: ['SCAM', 'SPAM'],
    });
    expect(() =>
      decodeQueuePage({
        items: [{ ...page.items[0], post: SUMMARY, reasons: ['RUDE'] }],
        page: 1,
        pageSize: 20,
        total: 1,
      }),
    ).toThrow();
  });

  it('decodes a case and a decision', () => {
    expect(
      decodeCase({ post: DETAIL, reports: [REPORT] }).reports[0],
    ).toMatchObject({ reason: 'SCAM', status: 'REVIEWING' });
    expect(
      decodeResult({
        postId: SUMMARY.id,
        action: 'REMOVE_POST',
        postStatus: 'DELETED',
        resolvedReports: 3,
        authorBanned: false,
      }),
    ).toMatchObject({ action: 'REMOVE_POST', postStatus: 'DELETED' });
  });
});

describe('HTTP moderation adapter', () => {
  function setup(reply: unknown) {
    const calls: { url: URL; method: string; body: unknown }[] = [];
    const http = createHttpClient({
      baseUrl: 'https://api.example.test/api/v1',
      fetcher: vi.fn<typeof fetch>(async (input, init = {}) => {
        calls.push({
          url: new URL(String(input)),
          method: init.method ?? 'GET',
          body: init.body ? JSON.parse(String(init.body)) : undefined,
        });
        return new Response(JSON.stringify(reply), { status: 200 });
      }),
      session: { accessToken: () => 'admin', refresh: async () => 'renewed' },
    });
    return { service: createHttpModerationService(http), calls };
  }

  it('decides with the action and the note', async () => {
    const { service, calls } = setup({
      postId: SUMMARY.id,
      action: 'BAN_USER',
      postStatus: 'HIDDEN',
      resolvedReports: 2,
      authorBanned: true,
    });
    const result = await service.decide(SUMMARY.id, 'BAN_USER', 'Scam links');
    expect(result.authorBanned).toBe(true);
    expect(calls[0]).toMatchObject({
      method: 'POST',
      body: { action: 'BAN_USER', note: 'Scam links' },
    });
    expect(calls[0]?.url.pathname).toBe(
      '/api/v1/admin/reports-queue/' + SUMMARY.id + '/decision',
    );
  });

  it('restores a hidden post', async () => {
    const { service, calls } = setup(DETAIL);
    await service.restore(SUMMARY.id);
    expect(calls[0]?.url.pathname).toBe(
      '/api/v1/admin/posts/' + SUMMARY.id + '/restore',
    );
    expect(calls[0]?.method).toBe('POST');
  });

  it('answers NOT_CONFIGURED while no API is configured', async () => {
    await expect(
      createPendingModerationService().queue(1, 20),
    ).rejects.toMatchObject({ code: 'NOT_CONFIGURED' });
  });
});
