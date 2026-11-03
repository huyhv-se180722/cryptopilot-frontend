import type {
  AuditActor,
  AuditLogEntry,
  AuditLogPage,
  AuditLogQuery,
  AuditValue,
  FeedHealth,
  ServiceHealth,
  SystemEvent,
  SystemEventCategory,
  SystemEventPage,
  SystemEventSource,
  SystemHealth,
} from '../../types/domain';
import type { AdminAuditService } from './contracts';
import {
  instant,
  integer,
  list,
  nullableInstant,
  nullableText,
  oneOf,
  record,
  text,
} from './decode';
import { integrationPending } from './errors';
import type { HttpClient } from './http-client';

export const AUDIT_PAGE_SIZE = 20;

export const SYSTEM_EVENT_CATEGORIES: readonly SystemEventCategory[] = [
  'SYSTEM_ERROR',
  'EXTERNAL_API_FAILURE',
];

export const SYSTEM_EVENT_SOURCES: readonly SystemEventSource[] = [
  'APPLICATION',
  'SCHEDULED_JOB',
  'BINANCE_REST',
  'AI_SERVICE',
  'MEDIA_STORAGE',
  'NEWS_SOURCE',
  'MAIL',
];

const count = (value: unknown, name: string) => {
  const n = integer(value, name);
  if (n < 0) throw new Error(name + ' must not be negative');
  return n;
};

const nullableId = (value: unknown, name: string) =>
  value === null || value === undefined ? null : text(value, name);

/** A stored JSON value as it came, objects and arrays included. */
function auditValue(value: unknown): AuditValue | null {
  if (value === undefined || value === null) return null;
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  )
    return value;
  if (Array.isArray(value)) return value.map(auditValue);
  if (typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        auditValue(v),
      ]),
    );
  throw new Error('audit value is not JSON');
}

function actor(value: unknown): AuditActor | null {
  if (value === null || value === undefined) return null;
  const body = record(value, 'actor');
  return {
    id: text(body.id, 'actor.id'),
    email: nullableText(body.email, 'actor.email'),
    displayName: nullableText(body.displayName, 'actor.displayName'),
    role:
      body.role === null || body.role === undefined
        ? null
        : oneOf(['TRADER', 'ADMIN'] as const, body.role, 'actor.role'),
  };
}

/**
 * Decoders for `/admin/audit-log`, `/admin/system-events` and
 * `/admin/system-health` (UC-46), checked against backend
 * `feat/uc-52-audit-log`: `AuditLogEntryResponse`, `SystemEventResponse`
 * and `SystemHealthResponse`, in `PageResponse` (one-based pages).
 */
export function decodeAuditLogEntry(item: unknown): AuditLogEntry {
  const value = record(item, 'entry');
  return {
    id: text(value.id, 'id'),
    recordedAt: instant(value.recordedAt, 'recordedAt'),
    actor: actor(value.actor),
    action: text(value.action, 'action'),
    entityType: nullableText(value.entityType, 'entityType'),
    entityId: nullableId(value.entityId, 'entityId'),
    ipAddress: nullableText(value.ipAddress, 'ipAddress'),
    oldValue: auditValue(value.oldValue),
    newValue: auditValue(value.newValue),
  };
}

export function decodeAuditLogPage(body: unknown): AuditLogPage {
  const value = record(body);
  return {
    items: list(value.items, 'items').map(decodeAuditLogEntry),
    page: count(value.page, 'page'),
    pageSize: count(value.pageSize, 'pageSize'),
    total: count(value.total, 'total'),
  };
}

export function decodeSystemEvent(item: unknown): SystemEvent {
  const value = record(item, 'event');
  return {
    id: text(value.id, 'id'),
    category: oneOf(SYSTEM_EVENT_CATEGORIES, value.category, 'category'),
    source: oneOf(SYSTEM_EVENT_SOURCES, value.source, 'source'),
    operation: text(value.operation, 'operation'),
    errorType: text(value.errorType, 'errorType'),
    message: nullableText(value.message, 'message'),
    reference: nullableText(value.reference, 'reference'),
    occurrences: count(value.occurrences, 'occurrences'),
    firstSeenAt: instant(value.firstSeenAt, 'firstSeenAt'),
    lastSeenAt: instant(value.lastSeenAt, 'lastSeenAt'),
  };
}

export function decodeSystemEventPage(body: unknown): SystemEventPage {
  const value = record(body);
  return {
    items: list(value.items, 'items').map(decodeSystemEvent),
    page: count(value.page, 'page'),
    pageSize: count(value.pageSize, 'pageSize'),
    total: count(value.total, 'total'),
  };
}

function service(item: unknown): ServiceHealth {
  const value = record(item, 'service');
  return {
    source: oneOf(SYSTEM_EVENT_SOURCES, value.source, 'source'),
    status: oneOf(
      ['UP', 'DEGRADED', 'DOWN', 'UNKNOWN'] as const,
      value.status,
      'status',
    ),
    lastSuccessAt: nullableInstant(value.lastSuccessAt, 'lastSuccessAt'),
    lastFailureAt: nullableInstant(value.lastFailureAt, 'lastFailureAt'),
    failures24h: count(value.failures24h, 'failures24h'),
    lastError: nullableText(value.lastError, 'lastError'),
    bannedUntil: nullableInstant(value.bannedUntil, 'bannedUntil'),
  };
}

function feed(item: unknown): FeedHealth {
  const value = record(item, 'feed');
  return {
    market: oneOf(['SPOT', 'FUTURES'] as const, value.market, 'market'),
    latestCandleAt: nullableInstant(value.latestCandleAt, 'latestCandleAt'),
    lagSeconds:
      value.lagSeconds === null || value.lagSeconds === undefined
        ? null
        : count(value.lagSeconds, 'lagSeconds'),
    stale: value.stale === true,
  };
}

export function decodeSystemHealth(body: unknown): SystemHealth {
  const value = record(body);
  return {
    checkedAt: instant(value.checkedAt, 'checkedAt'),
    recentWindowMinutes: count(
      value.recentWindowMinutes,
      'recentWindowMinutes',
    ),
    staleAfterMinutes: count(value.staleAfterMinutes, 'staleAfterMinutes'),
    services: list(value.services, 'services').map(service),
    feeds: list(value.feeds, 'feeds').map(feed),
  };
}

/** The query string of an audit search; repeated `action` for several. */
export function auditParams(
  query: Partial<AuditLogQuery>,
  pageSize?: number,
): URLSearchParams {
  const params = new URLSearchParams();
  if (query.page !== undefined) params.set('page', String(query.page));
  if (pageSize !== undefined) params.set('pageSize', String(pageSize));
  if (query.actor) params.set('actor', query.actor);
  if (query.actorId) params.set('actorId', query.actorId);
  if (query.actorType) params.set('actorType', query.actorType);
  for (const action of query.actions ?? []) params.append('action', action);
  if (query.entityType) params.set('entityType', query.entityType);
  if (query.entityId) params.set('entityId', query.entityId);
  if (query.from) params.set('from', query.from);
  if (query.to) params.set('to', query.to);
  return params;
}

/** Used while no API base URL is configured. */
export function createPendingAdminAuditService(): AdminAuditService {
  return {
    auditLog: async () => integrationPending(),
    exportAuditLog: async () => integrationPending(),
    systemEvents: async () => integrationPending(),
    health: async () => integrationPending(),
  };
}

/** SCR-44 (UC-46), Admin only. */
export function createHttpAdminAuditService(
  http: HttpClient,
): AdminAuditService {
  return {
    auditLog: (query, signal) =>
      http.request({
        path: 'admin/audit-log?' + auditParams(query, AUDIT_PAGE_SIZE),
        decode: decodeAuditLogPage,
        ...(signal ? { signal } : {}),
      }),
    exportAuditLog: (query) => {
      const params = auditParams(query).toString();
      return http.request({
        path: 'admin/audit-log/export' + (params ? '?' + params : ''),
        headers: { Accept: 'text/csv' },
        responseType: 'text',
        decode: (body) => {
          if (typeof body !== 'string') throw new Error('CSV must be text');
          return body;
        },
      });
    },
    systemEvents: (query, signal) => {
      const params = new URLSearchParams({
        page: String(query.page),
        pageSize: String(AUDIT_PAGE_SIZE),
      });
      if (query.category) params.set('category', query.category);
      if (query.source) params.set('source', query.source);
      if (query.from) params.set('from', query.from);
      if (query.to) params.set('to', query.to);
      return http.request({
        path: 'admin/system-events?' + params.toString(),
        decode: decodeSystemEventPage,
        ...(signal ? { signal } : {}),
      });
    },
    health: (signal) =>
      http.request({
        path: 'admin/system-health',
        decode: decodeSystemHealth,
        ...(signal ? { signal } : {}),
      }),
  };
}
