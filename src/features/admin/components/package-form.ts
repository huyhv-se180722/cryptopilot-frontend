import {
  AI_QUOTA_MAX,
  LIMIT_COUNT_MAX,
  PACKAGE_CODE_MAX,
  PACKAGE_DURATION_MAX,
  PACKAGE_NAME_MAX,
  PACKAGE_PRICE_MAX,
  type AdminPackage,
  type NewPackage,
  type PackageChange,
  type TierLimits,
} from '../hooks/use-admin-packages';
import type { Copy } from '../../../i18n/locales/en';
import type { PlanTier } from '../../../types/domain';

/** What the package form holds while it is typed: text, as typed. */
export interface PackageDraft {
  code: string;
  name: string;
  tier: PlanTier;
  price: string;
  durationDays: string;
  purchasable: boolean;
}

export type PackageField = 'code' | 'name' | 'price' | 'durationDays';
export type PackageErrors = Partial<
  Record<PackageField, 'required' | 'invalid'>
>;

const CODE = /^[A-Z0-9_]+$/;
const WHOLE = /^\d+$/;

export function newPackageDraft(): PackageDraft {
  return {
    code: '',
    name: '',
    tier: 'PRO',
    price: '',
    durationDays: '30',
    purchasable: true,
  };
}

export function packageDraftOf(pkg: AdminPackage): PackageDraft {
  return {
    code: pkg.code,
    name: pkg.name,
    tier: pkg.tier,
    // VND has no fraction; a stored "99000.00" is typed as 99000.
    price: pkg.price.replace(/\.0+$/, ''),
    durationDays: pkg.durationDays === null ? '' : String(pkg.durationDays),
    purchasable: pkg.purchasable,
  };
}

function whole(raw: string, min: number, max: number): number | null {
  const value = raw.trim();
  if (!WHOLE.test(value)) return null;
  const n = Number(value);
  return n >= min && n <= max ? n : null;
}

function checkName(name: string, errors: PackageErrors) {
  if (name === '') errors.name = 'required';
  else if (name.length > PACKAGE_NAME_MAX) errors.name = 'invalid';
}

function checkOffer(draft: PackageDraft, errors: PackageErrors) {
  const price = whole(draft.price, 1, PACKAGE_PRICE_MAX);
  const days = whole(draft.durationDays, 1, PACKAGE_DURATION_MAX);
  if (draft.price.trim() === '') errors.price = 'required';
  else if (price === null) errors.price = 'invalid';
  if (draft.durationDays.trim() === '') errors.durationDays = 'required';
  else if (days === null) errors.durationDays = 'invalid';
  return { price, days };
}

/** A new paid package, or why a field is refused before sending. */
export function newPackageOf(
  draft: PackageDraft,
): { ok: true; input: NewPackage } | { ok: false; errors: PackageErrors } {
  const errors: PackageErrors = {};
  const code = draft.code.trim();
  if (code === '') errors.code = 'required';
  else if (code.length > PACKAGE_CODE_MAX || !CODE.test(code))
    errors.code = 'invalid';
  const name = draft.name.trim();
  checkName(name, errors);
  const { price, days } = checkOffer(draft, errors);
  if (Object.keys(errors).length || price === null || days === null)
    return { ok: false, errors };
  return {
    ok: true,
    input: {
      code,
      name,
      tier: draft.tier,
      price,
      durationDays: days,
      purchasable: draft.purchasable,
    },
  };
}

/**
 * The change of an existing package. The FREE package sends its name only:
 * the backend refuses an offer field for it (FREE_PACKAGE_FIXED).
 */
export function packageChangeOf(
  draft: PackageDraft,
  tier: PlanTier,
): { ok: true; change: PackageChange } | { ok: false; errors: PackageErrors } {
  const errors: PackageErrors = {};
  const name = draft.name.trim();
  checkName(name, errors);
  if (tier === 'FREE')
    return Object.keys(errors).length
      ? { ok: false, errors }
      : { ok: true, change: { name } };
  const { price, days } = checkOffer(draft, errors);
  if (Object.keys(errors).length || price === null || days === null)
    return { ok: false, errors };
  return {
    ok: true,
    change: {
      name,
      price,
      durationDays: days,
      purchasable: draft.purchasable,
    },
  };
}

export type CountField = 'activePlanMax' | 'watchlistMax' | 'activeAlertMax';
export const COUNT_FIELDS: readonly CountField[] = [
  'activePlanMax',
  'watchlistMax',
  'activeAlertMax',
];
export type FeatureField = Exclude<
  keyof TierLimits,
  CountField | 'aiDailyQuota'
>;
export const FEATURE_FIELDS: readonly FeatureField[] = [
  'futuresAnalysis',
  'scoreComponents',
  'indicatorAlert',
  'externalAlertChannels',
  'advancedPerformance',
  'newsAiInsight',
  'aiPerformanceContext',
  'videoPost',
];

/** The limits form: counts as typed text, empty for no limit. */
export type LimitsDraft = Record<FeatureField, boolean> &
  Record<CountField | 'aiDailyQuota', string>;
export type LimitsErrors = Partial<Record<CountField | 'aiDailyQuota', true>>;

export function limitsDraftOf(limits: TierLimits): LimitsDraft {
  const text = (n: number | null) => (n === null ? '' : String(n));
  return {
    futuresAnalysis: limits.futuresAnalysis,
    scoreComponents: limits.scoreComponents,
    indicatorAlert: limits.indicatorAlert,
    externalAlertChannels: limits.externalAlertChannels,
    advancedPerformance: limits.advancedPerformance,
    newsAiInsight: limits.newsAiInsight,
    aiPerformanceContext: limits.aiPerformanceContext,
    videoPost: limits.videoPost,
    activePlanMax: text(limits.activePlanMax),
    watchlistMax: text(limits.watchlistMax),
    activeAlertMax: text(limits.activeAlertMax),
    aiDailyQuota: String(limits.aiDailyQuota),
  };
}

/** The limits to save, or which counts are refused before sending. */
export function limitsOf(
  draft: LimitsDraft,
): { ok: true; limits: TierLimits } | { ok: false; errors: LimitsErrors } {
  const errors: LimitsErrors = {};
  const counts = {} as Record<CountField, number | null>;
  for (const field of COUNT_FIELDS) {
    const raw = draft[field].trim();
    if (raw === '') {
      counts[field] = null;
      continue;
    }
    const n = whole(raw, 0, LIMIT_COUNT_MAX);
    if (n === null) errors[field] = true;
    counts[field] = n;
  }
  const quota = whole(draft.aiDailyQuota, 0, AI_QUOTA_MAX);
  if (quota === null) errors.aiDailyQuota = true;
  if (Object.keys(errors).length || quota === null)
    return { ok: false, errors };
  return {
    ok: true,
    limits: {
      futuresAnalysis: draft.futuresAnalysis,
      scoreComponents: draft.scoreComponents,
      activePlanMax: counts.activePlanMax,
      watchlistMax: counts.watchlistMax,
      activeAlertMax: counts.activeAlertMax,
      indicatorAlert: draft.indicatorAlert,
      externalAlertChannels: draft.externalAlertChannels,
      advancedPerformance: draft.advancedPerformance,
      newsAiInsight: draft.newsAiInsight,
      aiDailyQuota: quota,
      aiPerformanceContext: draft.aiPerformanceContext,
      videoPost: draft.videoPost,
    },
  };
}

/** One tier's packages and the limits they share (BR-62). */
export interface TierGroup {
  tier: PlanTier;
  packages: readonly AdminPackage[];
  /** The tier's limits, from its first package; null without one. */
  limits: TierLimits | null;
}

export function tierGroups(
  packages: readonly AdminPackage[],
  tiers: readonly PlanTier[],
): readonly TierGroup[] {
  return tiers.map((tier) => {
    const own = packages.filter((p) => p.tier === tier);
    return { tier, packages: own, limits: own[0]?.limits ?? null };
  });
}

export const tierName = (copy: Copy, tier: PlanTier) =>
  tier === 'FREE'
    ? copy.adminPackages.free
    : tier === 'PRO'
      ? 'Pro'
      : 'Premium';

export const featureLabel = (copy: Copy, field: FeatureField) => {
  const b = copy.billing;
  return {
    futuresAnalysis: b.featureFuturesAnalysis,
    scoreComponents: b.featureScoreComponents,
    indicatorAlert: b.featureIndicatorAlert,
    externalAlertChannels: b.featureExternalAlertChannels,
    advancedPerformance: b.featureAdvancedPerformance,
    newsAiInsight: copy.adminPackages.featureNewsAiInsight,
    aiPerformanceContext: b.featureAiPerformanceContext,
    videoPost: b.featureVideoPost,
  }[field];
};
