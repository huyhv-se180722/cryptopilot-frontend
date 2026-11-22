import type { PlanTier } from '../../types/domain';
import {
  decimal,
  flag,
  instant,
  integer,
  list,
  oneOf,
  record,
  text,
} from './decode';
import { integrationPending } from './errors';
import type { HttpClient } from './http-client';

export const PACKAGE_TIERS: readonly PlanTier[] = ['FREE', 'PRO', 'PREMIUM'];
/** Tiers a new package may take: FREE has exactly one package (BR-62). */
export const PAID_TIERS: readonly PlanTier[] = ['PRO', 'PREMIUM'];

/**
 * The limits and features of a plan tier (BR-62). A `null` count means no
 * limit. They belong to the tier: every package of a tier carries the same.
 */
export interface TierLimits {
  futuresAnalysis: boolean;
  scoreComponents: boolean;
  activePlanMax: number | null;
  watchlistMax: number | null;
  activeAlertMax: number | null;
  indicatorAlert: boolean;
  externalAlertChannels: boolean;
  advancedPerformance: boolean;
  newsAiInsight: boolean;
  aiDailyQuota: number;
  aiPerformanceContext: boolean;
  videoPost: boolean;
}

/** One package in the administrator's console (SCR-39, UC-42). */
export interface AdminPackage {
  id: string;
  code: string;
  name: string;
  tier: PlanTier;
  tierRank: number;
  /** VND, a decimal string; 0 for FREE. */
  price: string;
  currency: string;
  /** null for FREE, which never ends. */
  durationDays: number | null;
  /** Offered on the plans page. */
  purchasable: boolean;
  active: boolean;
  /** Orders were placed for it: it can be deactivated, never deleted. */
  hasOrders: boolean;
  limits: TierLimits;
  updatedAt: string;
}

export interface NewPackage {
  code: string;
  name: string;
  tier: PlanTier;
  price: number;
  durationDays: number;
  purchasable: boolean;
}

/** The FREE package takes a new name only: the offer fields are left out. */
export interface PackageChange {
  name: string;
  price?: number;
  durationDays?: number;
  purchasable?: boolean;
}

/** SCR-39 (UC-42): the subscription packages, Admin only. */
export interface AdminPackageService {
  list(signal?: AbortSignal): Promise<readonly AdminPackage[]>;
  create(input: NewPackage): Promise<AdminPackage>;
  update(packageId: string, change: PackageChange): Promise<AdminPackage>;
  setActive(packageId: string, active: boolean): Promise<AdminPackage>;
  remove(packageId: string): Promise<void>;
  /** Saves the limits to every package of the tier; answers them afterwards. */
  saveTierLimits(
    tier: PlanTier,
    limits: TierLimits,
  ): Promise<readonly AdminPackage[]>;
}

/** The request's bounds, as the backend checks them (MSG15 past them). */
export const PACKAGE_CODE_MAX = 32;
export const PACKAGE_NAME_MAX = 100;
export const PACKAGE_PRICE_MAX = 999_999_999_999;
export const PACKAGE_DURATION_MAX = 366;
export const LIMIT_COUNT_MAX = 100_000;
export const AI_QUOTA_MAX = 10_000;

function count(value: unknown, name: string): number | null {
  return value === null || value === undefined ? null : integer(value, name);
}

function decodeLimits(body: unknown): TierLimits {
  const v = record(body, 'limits');
  return {
    futuresAnalysis: flag(v.futuresAnalysis, 'limits.futuresAnalysis'),
    scoreComponents: flag(v.scoreComponents, 'limits.scoreComponents'),
    activePlanMax: count(v.activePlanMax, 'limits.activePlanMax'),
    watchlistMax: count(v.watchlistMax, 'limits.watchlistMax'),
    activeAlertMax: count(v.activeAlertMax, 'limits.activeAlertMax'),
    indicatorAlert: flag(v.indicatorAlert, 'limits.indicatorAlert'),
    externalAlertChannels: flag(
      v.externalAlertChannels,
      'limits.externalAlertChannels',
    ),
    advancedPerformance: flag(
      v.advancedPerformance,
      'limits.advancedPerformance',
    ),
    newsAiInsight: flag(v.newsAiInsight, 'limits.newsAiInsight'),
    aiDailyQuota: integer(v.aiDailyQuota, 'limits.aiDailyQuota'),
    aiPerformanceContext: flag(
      v.aiPerformanceContext,
      'limits.aiPerformanceContext',
    ),
    videoPost: flag(v.videoPost, 'limits.videoPost'),
  };
}

/**
 * Decoder for `AdminPackageResponse`, checked against the backend branch
 * of PR #113 (`feat/admin-packages-push-paper-realtime` @ 0f877dd9).
 */
export function decodeAdminPackage(body: unknown): AdminPackage {
  const v = record(body, 'package');
  return {
    id: text(v.id, 'id'),
    code: text(v.code, 'code'),
    name: text(v.name, 'name'),
    tier: oneOf(PACKAGE_TIERS, v.tier, 'tier'),
    tierRank: integer(v.tierRank, 'tierRank'),
    price:
      typeof v.price === 'number' ? String(v.price) : decimal(v.price, 'price'),
    currency: text(v.currency, 'currency'),
    durationDays: count(v.durationDays, 'durationDays'),
    purchasable: flag(v.purchasable, 'purchasable'),
    active: flag(v.active, 'active'),
    hasOrders: flag(v.hasOrders, 'hasOrders'),
    limits: decodeLimits(v.limits),
    updatedAt: instant(v.updatedAt, 'updatedAt'),
  };
}

export function decodeAdminPackages(body: unknown): readonly AdminPackage[] {
  return list(body, 'packages').map(decodeAdminPackage);
}

/** Used while no API base URL is configured. */
export function createPendingAdminPackageService(): AdminPackageService {
  return {
    list: async () => integrationPending(),
    create: async () => integrationPending(),
    update: async () => integrationPending(),
    setActive: async () => integrationPending(),
    remove: async () => integrationPending(),
    saveTierLimits: async () => integrationPending(),
  };
}

/** `/admin/packages/**` (UC-42), Admin only; every change is audited. */
export function createHttpAdminPackageService(
  http: HttpClient,
): AdminPackageService {
  const path = (packageId: string) =>
    'admin/packages/' + encodeURIComponent(packageId);
  return {
    list: (signal) =>
      http.request({
        path: 'admin/packages',
        decode: decodeAdminPackages,
        ...(signal ? { signal } : {}),
      }),
    create: (input) =>
      http.request({
        path: 'admin/packages',
        method: 'POST',
        body: input,
        decode: decodeAdminPackage,
      }),
    update: (packageId, change) =>
      http.request({
        path: path(packageId),
        method: 'PUT',
        body: change,
        decode: decodeAdminPackage,
      }),
    setActive: (packageId, active) =>
      http.request({
        path: path(packageId) + '/active',
        method: 'PATCH',
        body: { active },
        decode: decodeAdminPackage,
      }),
    remove: (packageId) =>
      http.request({
        path: path(packageId),
        method: 'DELETE',
        decode: () => undefined,
      }),
    saveTierLimits: (tier, limits) =>
      http.request({
        path: 'admin/packages/tiers/' + tier + '/limits',
        method: 'PUT',
        body: limits,
        decode: decodeAdminPackages,
      }),
  };
}
