import type { ModerationService } from './contracts';
import { integrationPending } from './errors';
import type { HttpClient } from './http-client';
import type {
  ModerationAction,
  ModerationCase,
  ModerationQueueItem,
  ModerationQueuePage,
  ModerationReport,
  ModerationResult,
  PostStatus,
  ReportReason,
  ReportStatus,
} from '../../types/domain';
import { decodePostDetail, decodePostSummary } from './community-dto';
import {
  flag,
  instant,
  integer,
  list,
  nullableText,
  oneOf,
  record,
  text,
} from './decode';

/**
 * `/admin/reports-queue/**` and `/admin/posts/**` (SRS 3.11.3, UC-43),
 * checked against the backend community branch @ d43b90c:
 * `QueueItemResponse`, `ModerationCaseResponse`,
 * `ModerationDecisionRequest`, `ModerationDecisionResponse`.
 */
const REASONS: readonly ReportReason[] = [
  'SPAM',
  'SCAM',
  'ABUSE',
  'MISLEADING',
  'OTHER',
];
const REPORT_STATUSES: readonly ReportStatus[] = [
  'OPEN',
  'REVIEWING',
  'RESOLVED',
];
const ACTIONS: readonly ModerationAction[] = [
  'HIDE_POST',
  'REMOVE_POST',
  'DISMISS',
  'WARN_USER',
  'BAN_USER',
];
const POST_STATUSES: readonly PostStatus[] = ['PUBLISHED', 'HIDDEN', 'DELETED'];

function count(value: unknown, name: string): number {
  const n = integer(value, name);
  if (n < 0) throw new Error(name + ' must not be negative');
  return n;
}

function decodeQueueItem(body: unknown): ModerationQueueItem {
  const value = record(body, 'item');
  return {
    post: decodePostSummary(value.post),
    reportCount: count(value.reportCount, 'reportCount'),
    reasons: list(value.reasons, 'reasons').map((r) =>
      oneOf(REASONS, r, 'reason'),
    ),
    firstReportedAt: instant(value.firstReportedAt, 'firstReportedAt'),
    lastReportedAt: instant(value.lastReportedAt, 'lastReportedAt'),
  };
}

export function decodeQueuePage(body: unknown): ModerationQueuePage {
  const value = record(body);
  return {
    items: list(value.items, 'items').map(decodeQueueItem),
    page: integer(value.page, 'page'),
    pageSize: integer(value.pageSize, 'pageSize'),
    total: count(value.total, 'total'),
  };
}

function decodeReport(body: unknown): ModerationReport {
  const value = record(body, 'report');
  const reporter = record(value.reporter, 'reporter');
  return {
    id: text(value.id, 'id'),
    reporter: {
      userId: text(reporter.userId, 'reporter.userId'),
      displayName: nullableText(reporter.displayName, 'reporter.displayName'),
      avatarUrl: nullableText(reporter.avatarUrl, 'reporter.avatarUrl'),
    },
    reason: oneOf(REASONS, value.reason, 'reason'),
    description: nullableText(value.description, 'description'),
    status: oneOf(REPORT_STATUSES, value.status, 'status'),
    createdAt: instant(value.createdAt, 'createdAt'),
  };
}

export function decodeCase(body: unknown): ModerationCase {
  const value = record(body);
  return {
    post: decodePostDetail(value.post),
    reports: list(value.reports, 'reports').map(decodeReport),
  };
}

export function decodeResult(body: unknown): ModerationResult {
  const value = record(body);
  return {
    postId: text(value.postId, 'postId'),
    action: oneOf(ACTIONS, value.action, 'action'),
    postStatus: oneOf(POST_STATUSES, value.postStatus, 'postStatus'),
    resolvedReports: count(value.resolvedReports, 'resolvedReports'),
    authorBanned: flag(value.authorBanned, 'authorBanned'),
  };
}

/** Used until the backend moderation API is merged and configured. */
export function createPendingModerationService(): ModerationService {
  return {
    queue: async () => integrationPending(),
    open: async () => integrationPending(),
    decide: async () => integrationPending(),
    post: async () => integrationPending(),
    restore: async () => integrationPending(),
  };
}

const id = (value: string) => encodeURIComponent(value);
const withSignal = (signal?: AbortSignal) => (signal ? { signal } : {});

/** The Admin's moderation calls with the bearer token. */
export function createHttpModerationService(
  http: HttpClient,
): ModerationService {
  return {
    queue: (page, pageSize, signal) =>
      http.request({
        path:
          'admin/reports-queue?' +
          new URLSearchParams({
            page: String(page),
            pageSize: String(pageSize),
          }).toString(),
        decode: decodeQueuePage,
        ...withSignal(signal),
      }),
    open: (postId, signal) =>
      http.request({
        path: 'admin/reports-queue/' + id(postId),
        decode: decodeCase,
        ...withSignal(signal),
      }),
    decide: (postId, action, note) =>
      http.request({
        path: 'admin/reports-queue/' + id(postId) + '/decision',
        method: 'POST',
        body: { action, note },
        decode: decodeResult,
      }),
    post: (postId, signal) =>
      http.request({
        path: 'admin/posts/' + id(postId),
        decode: decodePostDetail,
        ...withSignal(signal),
      }),
    restore: (postId) =>
      http.request({
        path: 'admin/posts/' + id(postId) + '/restore',
        method: 'POST',
        decode: decodePostDetail,
      }),
  };
}
