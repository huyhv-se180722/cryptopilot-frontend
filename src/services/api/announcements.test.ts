import { describe, expect, it, vi } from 'vitest';
import { createHttpClient } from './http-client';
import {
  createHttpAnnouncementService,
  createPendingAnnouncementService,
} from './announcements';

/** Shapes of backend develop @ 796f408 (`PostDetailResponse`). */
const DETAIL = {
  id: '0199b100-0000-7000-8000-000000000009',
  author: {
    userId: '0199b000-0000-7000-8000-000000000001',
    displayName: 'CryptoPilot Team',
    avatarUrl: null,
  },
  title: 'Maintenance window',
  content: 'Platform maintenance tonight.',
  postType: 'TEXT',
  marketType: null,
  official: true,
  officialCategory: 'PLATFORM_UPDATE',
  status: 'PUBLISHED',
  coins: [],
  media: [],
  likeCount: 0,
  commentCount: 0,
  likedByMe: false,
  savedByMe: false,
  mine: true,
  createdAt: '2026-10-23T05:15:10Z',
  updatedAt: '2026-10-23T05:15:10Z',
};

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
    session: { accessToken: () => 'admin', refresh: async () => 'renewed' },
  });
  return { service: createHttpAnnouncementService(http), calls };
}

const DRAFT = {
  title: 'Maintenance window',
  content: 'Platform maintenance tonight.',
  market: null,
  coins: [],
  media: [],
  officialCategory: 'PLATFORM_UPDATE',
} as const;

describe('HTTP announcement adapter (UC-44)', () => {
  it('lists a category a page at a time', async () => {
    const { service, calls } = setup({
      items: [],
      page: 2,
      pageSize: 20,
      total: 21,
    });
    const page = await service.list({
      category: 'EDUCATION',
      page: 2,
      pageSize: 20,
    });
    expect(page.total).toBe(21);
    expect(calls[0]?.url.pathname).toBe('/api/v1/admin/announcements');
    expect(Object.fromEntries(calls[0]?.url.searchParams ?? [])).toEqual({
      category: 'EDUCATION',
      page: '2',
      pageSize: '20',
    });
  });

  it('publishes with the category of the official post', async () => {
    const { service, calls } = setup(DETAIL, 201);
    const post = await service.create(DRAFT);
    expect(post.officialCategory).toBe('PLATFORM_UPDATE');
    expect(calls[0]).toMatchObject({
      method: 'POST',
      body: {
        title: DRAFT.title,
        content: DRAFT.content,
        marketType: null,
        coins: [],
        media: [],
        officialCategory: 'PLATFORM_UPDATE',
      },
    });
  });

  it('edits, reads through the admin post path and deletes', async () => {
    const { service, calls } = setup(DETAIL);
    await service.update(DETAIL.id, {
      ...DRAFT,
      officialCategory: 'EDUCATION',
    });
    await service.get(DETAIL.id);
    expect(calls[0]).toMatchObject({
      method: 'PUT',
      body: { officialCategory: 'EDUCATION' },
    });
    expect(calls[0]?.url.pathname).toBe(
      '/api/v1/admin/announcements/' + DETAIL.id,
    );
    expect(calls[1]?.url.pathname).toBe('/api/v1/admin/posts/' + DETAIL.id);
    const removed = setup(null, 204);
    await removed.service.remove(DETAIL.id);
    expect(removed.calls[0]?.method).toBe('DELETE');
  });

  it('answers NOT_CONFIGURED while no API is configured', async () => {
    await expect(
      createPendingAnnouncementService().list({ page: 1, pageSize: 20 }),
    ).rejects.toMatchObject({ code: 'NOT_CONFIGURED' });
  });
});
