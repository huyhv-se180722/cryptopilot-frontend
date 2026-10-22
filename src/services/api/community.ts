import type { CommunityService, ReactionTarget } from './contracts';
import { ServiceError, integrationPending } from './errors';
import type { HttpClient } from './http-client';
import type { PostMediaKind, PostMediaRef } from '../../types/domain';
import {
  decodeCoinDiscussion,
  decodeComment,
  decodeCommentPage,
  decodeEngagement,
  decodeMember,
  decodePostDetail,
  decodePostPage,
  decodeUploadForm,
  encodePostDraft,
  type UploadForm,
} from './community-dto';

/** Used until the backend community module is merged and configured. */
export function createPendingCommunityService(): CommunityService {
  return {
    feed: async () => integrationPending(),
    pinned: async () => integrationPending(),
    coinDiscussion: async () => integrationPending(),
    post: async () => integrationPending(),
    create: async () => integrationPending(),
    update: async () => integrationPending(),
    remove: async () => integrationPending(),
    react: async () => integrationPending(),
    comments: async () => integrationPending(),
    comment: async () => integrationPending(),
    editComment: async () => integrationPending(),
    removeComment: async () => integrationPending(),
    report: async () => integrationPending(),
    member: async () => integrationPending(),
    upload: async () => integrationPending(),
  };
}

const id = (value: string) => encodeURIComponent(value);
const noContent = () => undefined;
const withSignal = (signal?: AbortSignal) => (signal ? { signal } : {});

function query(values: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values))
    if (value !== undefined && value !== '') params.set(key, String(value));
  const text = params.toString();
  return text ? '?' + text : '';
}

function reactionPath(target: ReactionTarget) {
  return target.kind === 'post'
    ? 'posts/' + id(target.id) + '/' + target.action
    : 'comments/' + id(target.id) + '/like';
}

/** "5 MB", as the backend names the limit in MSG32. */
export function sizeLimit(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return (Number.isInteger(mb) ? String(mb) : mb.toFixed(1)) + ' MB';
}

/** The same answer the backend gives for a file outside BR-44 (MSG32). */
export function mediaError(form: Pick<UploadForm, 'maxBytes'>): ServiceError {
  return new ServiceError(
    'The file is outside the limits.',
    'HTTP_ERROR',
    400,
    {
      status: 400,
      code: 'MEDIA_INVALID',
      messageCode: 'MSG32',
      messageArgs: [sizeLimit(form.maxBytes)],
      fieldErrors: {},
    },
  );
}
function mediaRejected(form: Pick<UploadForm, 'maxBytes'>): never {
  throw mediaError(form);
}

const ALIASES: Readonly<Record<string, string>> = { jpeg: 'jpg' };

/** The file's format as the storage names it, from its type or name. */
export function fileFormat(file: Pick<File, 'name' | 'type'>): string {
  const fromType = file.type.split('/')[1];
  const fromName = file.name.includes('.')
    ? file.name.slice(file.name.lastIndexOf('.') + 1)
    : '';
  const raw = (fromType || fromName).toLowerCase();
  return ALIASES[raw] ?? raw;
}

/** Checks a file against its signed form before uploading it (BR-44). */
export function checkFile(
  file: Pick<File, 'name' | 'type' | 'size'>,
  form: UploadForm,
  durationSeconds: number | null,
): void {
  if (!form.allowedFormats.includes(fileFormat(file))) mediaRejected(form);
  if (file.size === 0 || file.size > form.maxBytes) mediaRejected(form);
  if (
    form.maxDurationSeconds !== null &&
    durationSeconds !== null &&
    durationSeconds > form.maxDurationSeconds
  )
    mediaRejected(form);
}

/** A video's length read from its metadata, or null when it cannot be read. */
function videoDuration(file: File): Promise<number | null> {
  if (typeof URL.createObjectURL !== 'function') return Promise.resolve(null);
  return new Promise((resolve) => {
    const video = document.createElement('video');
    const url = URL.createObjectURL(file);
    const done = (value: number | null) => {
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      resolve(value);
    };
    const timer = setTimeout(() => done(null), 5_000);
    video.preload = 'metadata';
    video.onloadedmetadata = () =>
      done(Number.isFinite(video.duration) ? video.duration : null);
    video.onerror = () => done(null);
    video.src = url;
  });
}

/**
 * Posts the file to the storage with the signed fields (D-98). Any failure
 * of the storage is the file's (MSG32); the backend reads the stored file
 * back before it attaches it.
 */
function send(
  file: File,
  form: UploadForm,
  onProgress?: (share: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }
    const body = new FormData();
    body.append('file', file);
    body.append('api_key', form.apiKey);
    body.append('timestamp', String(form.timestamp));
    body.append('signature', form.signature);
    body.append('public_id', form.publicId);
    body.append('allowed_formats', form.allowedFormats.join(','));
    const request = new XMLHttpRequest();
    const abort = () => request.abort();
    signal?.addEventListener('abort', abort, { once: true });
    const finish = () => signal?.removeEventListener('abort', abort);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded / event.total);
    };
    request.onload = () => {
      finish();
      if (request.status >= 200 && request.status < 300) {
        onProgress?.(1);
        resolve();
        return;
      }
      reject(mediaError(form));
    };
    request.onerror = () => {
      finish();
      reject(mediaError(form));
    };
    request.onabort = () => {
      finish();
      reject(signal?.reason ?? new DOMException('Aborted', 'AbortError'));
    };
    request.open('POST', form.uploadUrl);
    request.send(body);
  });
}

/** `/posts/**`, `/comments/**`, `/media/**`, `/community/**` (D-98, D-99). */
export function createHttpCommunityService(http: HttpClient): CommunityService {
  return {
    feed: (q, signal) =>
      http.request({
        path:
          'posts' +
          query({
            tab: q.tab,
            coin: q.coin,
            market: q.market?.toUpperCase(),
            author: q.author,
            q: q.q,
            page: q.page,
            pageSize: q.pageSize,
          }),
        decode: decodePostPage,
        ...withSignal(signal),
      }),
    pinned: (q, signal) =>
      http.request({
        path:
          'posts/pinned' +
          query({ category: q.category, page: q.page, pageSize: q.pageSize }),
        decode: decodePostPage,
        ...withSignal(signal),
      }),
    coinDiscussion: (symbol, signal) =>
      http.request({
        path: 'posts/coins/' + id(symbol) + '/discussion',
        decode: decodeCoinDiscussion,
        ...withSignal(signal),
      }),
    post: (postId, signal) =>
      http.request({
        path: 'posts/' + id(postId),
        decode: decodePostDetail,
        ...withSignal(signal),
      }),
    create: (draft) =>
      http.request({
        path: 'posts',
        method: 'POST',
        body: encodePostDraft(draft),
        decode: decodePostDetail,
      }),
    update: (postId, draft) =>
      http.request({
        path: 'posts/' + id(postId),
        method: 'PUT',
        body: encodePostDraft(draft),
        decode: decodePostDetail,
      }),
    remove: (postId) =>
      http.request({
        path: 'posts/' + id(postId),
        method: 'DELETE',
        decode: noContent,
      }),
    react: (target, active) =>
      http.request({
        path: reactionPath(target),
        method: active ? 'POST' : 'DELETE',
        decode: decodeEngagement,
      }),
    comments: (postId, page, pageSize, signal) =>
      http.request({
        path: 'posts/' + id(postId) + '/comments' + query({ page, pageSize }),
        decode: decodeCommentPage,
        ...withSignal(signal),
      }),
    comment: (postId, content, parentCommentId) =>
      http.request({
        path: 'posts/' + id(postId) + '/comments',
        method: 'POST',
        body: { content, parentCommentId },
        decode: decodeComment,
      }),
    editComment: (commentId, content) =>
      http.request({
        path: 'comments/' + id(commentId),
        method: 'PUT',
        body: { content },
        decode: decodeComment,
      }),
    removeComment: (commentId) =>
      http.request({
        path: 'comments/' + id(commentId),
        method: 'DELETE',
        decode: noContent,
      }),
    report: async (postId, report) => {
      await http.request({
        path: 'posts/' + id(postId) + '/reports',
        method: 'POST',
        body: { reason: report.reason, description: report.description },
        decode: noContent,
      });
    },
    member: (memberId, signal) =>
      http.request({
        path: 'community/members/' + id(memberId),
        decode: decodeMember,
        ...withSignal(signal),
      }),
    upload: async (
      file: File,
      kind: PostMediaKind,
      onProgress?: (share: number) => void,
      signal?: AbortSignal,
    ): Promise<PostMediaRef> => {
      const form = await http.request({
        path: 'media/upload-signature',
        method: 'POST',
        body: { mediaType: kind },
        decode: decodeUploadForm,
        ...withSignal(signal),
      });
      if (form.kind !== kind) mediaRejected(form);
      checkFile(
        file,
        form,
        kind === 'VIDEO' && form.maxDurationSeconds !== null
          ? await videoDuration(file)
          : null,
      );
      await send(file, form, onProgress, signal);
      return { publicId: form.publicId, kind };
    },
  };
}
