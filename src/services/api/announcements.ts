import type { AnnouncementService } from './contracts';
import { integrationPending } from './errors';
import type { HttpClient } from './http-client';
import {
  decodePostDetail,
  decodePostPage,
  encodePostDraft,
} from './community-dto';

/** Used while no API base URL is configured. */
export function createPendingAnnouncementService(): AnnouncementService {
  return {
    list: async () => integrationPending(),
    get: async () => integrationPending(),
    create: async () => integrationPending(),
    update: async () => integrationPending(),
    remove: async () => integrationPending(),
  };
}

const id = (value: string) => encodeURIComponent(value);
const noContent = () => undefined;
const withSignal = (signal?: AbortSignal) => (signal ? { signal } : {});

/**
 * `/admin/announcements/**` (UC-44, BR-61), checked against backend
 * develop @ 796f408: `PostRequest` with `officialCategory`, answered with
 * `PostSummaryResponse` pages and `PostDetailResponse`. A post is read
 * through `/admin/posts/{id}`, which serves any status.
 */
export function createHttpAnnouncementService(
  http: HttpClient,
): AnnouncementService {
  return {
    list: ({ category, page, pageSize }, signal) =>
      http.request({
        path:
          'admin/announcements?' +
          new URLSearchParams({
            ...(category ? { category } : {}),
            page: String(page),
            pageSize: String(pageSize),
          }).toString(),
        decode: decodePostPage,
        ...withSignal(signal),
      }),
    get: (postId, signal) =>
      http.request({
        path: 'admin/posts/' + id(postId),
        decode: decodePostDetail,
        ...withSignal(signal),
      }),
    create: (draft) =>
      http.request({
        path: 'admin/announcements',
        method: 'POST',
        body: encodePostDraft(draft),
        decode: decodePostDetail,
      }),
    update: (postId, draft) =>
      http.request({
        path: 'admin/announcements/' + id(postId),
        method: 'PUT',
        body: encodePostDraft(draft),
        decode: decodePostDetail,
      }),
    remove: (postId) =>
      http.request({
        path: 'admin/announcements/' + id(postId),
        method: 'DELETE',
        decode: noContent,
      }),
  };
}
