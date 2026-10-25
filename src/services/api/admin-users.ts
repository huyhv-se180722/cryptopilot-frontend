import type {
  AccountRole,
  AccountStatus,
  AdminUserDetail,
  AdminUserPage,
  AdminUserSummary,
  AuditEntry,
  PlanTier,
} from '../../types/domain';
import type { AdminUserService } from './contracts';
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
import { integrationPending } from './errors';
import type { HttpClient } from './http-client';
import { RISK_PROFILES, TRADING_STYLES } from './profile-dto';

const ROLES = { TRADER: 'Trader', ADMIN: 'Admin' } as const;
const STATUSES = {
  ACTIVE: 'active',
  LOCKED: 'locked',
  BANNED: 'banned',
} as const;
const PLANS: readonly PlanTier[] = ['FREE', 'PRO', 'PREMIUM'];

const wireRole = (role: AccountRole) => (role === 'Admin' ? 'ADMIN' : 'TRADER');
const wireStatus = (status: AccountStatus) =>
  status.toUpperCase() as keyof typeof STATUSES;

const count = (value: unknown, name: string) => {
  const n = integer(value, name);
  if (n < 0) throw new Error(name + ' must not be negative');
  return n;
};

/**
 * Decoders for `/admin/users/**` (UC-42), checked against backend develop
 * @ 14fe5a4: `AdminUserSummaryResponse`, `AdminUserDetailResponse` with its
 * `AuditRecord`s, in `PageResponse` (one-based pages).
 */
export function decodeAdminUserSummary(body: unknown): AdminUserSummary {
  const value = record(body, 'account');
  return {
    userId: text(value.userId, 'userId'),
    email: text(value.email, 'email'),
    displayName: nullableText(value.displayName, 'displayName'),
    role: ROLES[oneOf(['TRADER', 'ADMIN'] as const, value.role, 'role')],
    status:
      STATUSES[
        oneOf(['ACTIVE', 'LOCKED', 'BANNED'] as const, value.status, 'status')
      ],
    plan: oneOf(PLANS, value.plan, 'plan'),
    emailVerified: flag(value.emailVerified, 'emailVerified'),
    lastLoginAt: nullableInstant(value.lastLoginAt, 'lastLoginAt'),
    createdAt: instant(value.createdAt, 'createdAt'),
  };
}

export function decodeAdminUserPage(body: unknown): AdminUserPage {
  const value = record(body);
  return {
    items: list(value.items, 'items').map(decodeAdminUserSummary),
    page: count(value.page, 'page'),
    pageSize: count(value.pageSize, 'pageSize'),
    total: count(value.total, 'total'),
  };
}

function auditEntry(item: unknown): AuditEntry {
  const value = record(item, 'audit');
  return {
    recordedAt: instant(value.recordedAt, 'recordedAt'),
    actorId: nullableText(value.actorId, 'actorId'),
    action: text(value.action, 'action'),
    oldValue: nullableText(value.oldValue, 'oldValue'),
    newValue: nullableText(value.newValue, 'newValue'),
    ipAddress: nullableText(value.ipAddress, 'ipAddress'),
  };
}

export function decodeAdminUserDetail(body: unknown): AdminUserDetail {
  const value = record(body);
  const activity = record(value.activity, 'activity');
  return {
    account: decodeAdminUserSummary(value.account),
    tradingStyle:
      value.tradingStyle === null || value.tradingStyle === undefined
        ? null
        : oneOf(TRADING_STYLES, value.tradingStyle, 'tradingStyle'),
    riskProfile:
      value.riskProfile === null || value.riskProfile === undefined
        ? null
        : oneOf(RISK_PROFILES, value.riskProfile, 'riskProfile'),
    activity: Object.fromEntries(
      Object.entries(activity).map(([name, n]) => [
        name,
        count(n, 'activity.' + name),
      ]),
    ),
    recentAudit: list(value.recentAudit, 'recentAudit').map(auditEntry),
  };
}

export const USERS_PAGE_SIZE = 20;

/** Used while no API base URL is configured. */
export function createPendingAdminUserService(): AdminUserService {
  return {
    search: async () => integrationPending(),
    get: async () => integrationPending(),
    act: async () => integrationPending(),
    changeRole: async () => integrationPending(),
  };
}

/**
 * `/admin/users/**` (UC-42), Admin only: a page of accounts newest first,
 * one account, lock / unlock / ban and the role, each with its reason.
 */
export function createHttpAdminUserService(http: HttpClient): AdminUserService {
  const id = (userId: string) => 'admin/users/' + encodeURIComponent(userId);
  return {
    search: (query, signal) => {
      const params = new URLSearchParams({
        page: String(query.page),
        pageSize: String(USERS_PAGE_SIZE),
      });
      if (query.q) params.set('q', query.q);
      if (query.role) params.set('role', wireRole(query.role));
      if (query.status) params.set('status', wireStatus(query.status));
      if (query.plan) params.set('plan', query.plan);
      return http.request({
        path: 'admin/users?' + params.toString(),
        decode: decodeAdminUserPage,
        ...(signal ? { signal } : {}),
      });
    },
    get: (userId, signal) =>
      http.request({
        path: id(userId),
        decode: decodeAdminUserDetail,
        ...(signal ? { signal } : {}),
      }),
    act: (userId, action, reason) =>
      http.request({
        path: id(userId) + '/' + action,
        method: 'POST',
        body: { reason },
        decode: decodeAdminUserDetail,
      }),
    changeRole: (userId, role, reason) =>
      http.request({
        path: id(userId) + '/role',
        method: 'PUT',
        body: { role: wireRole(role), reason },
        decode: decodeAdminUserDetail,
      }),
  };
}
