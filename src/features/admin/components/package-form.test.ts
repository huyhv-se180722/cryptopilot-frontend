import { describe, expect, it } from 'vitest';
import { decodeAdminPackage } from '../../../services/api/admin-packages';
import {
  limitsDraftOf,
  limitsOf,
  newPackageDraft,
  newPackageOf,
  packageChangeOf,
  packageDraftOf,
  tierGroups,
} from './package-form';

const limits = {
  futuresAnalysis: true,
  scoreComponents: true,
  activePlanMax: 20,
  watchlistMax: null,
  activeAlertMax: 50,
  indicatorAlert: true,
  externalAlertChannels: true,
  advancedPerformance: true,
  newsAiInsight: true,
  aiDailyQuota: 50,
  aiPerformanceContext: true,
  videoPost: false,
};

const body = {
  id: '0199a0f0-0000-7000-8000-000000000010',
  code: 'PRO_MONTHLY',
  name: 'Pro monthly',
  tier: 'PRO',
  tierRank: 1,
  price: '99000.00',
  currency: 'VND',
  durationDays: 30,
  purchasable: true,
  active: true,
  hasOrders: true,
  limits,
  updatedAt: '2026-11-22T03:00:00Z',
};

describe('admin package decoder (PR #113 AdminPackageResponse)', () => {
  it('reads a package with a null count as no limit', () => {
    const pkg = decodeAdminPackage(body);
    expect(pkg.price).toBe('99000.00');
    expect(pkg.limits.watchlistMax).toBe(null);
    expect(pkg.hasOrders).toBe(true);
  });

  it('reads the FREE package without a duration and a numeric price', () => {
    const pkg = decodeAdminPackage({
      ...body,
      tier: 'FREE',
      price: 0,
      durationDays: null,
    });
    expect(pkg.price).toBe('0');
    expect(pkg.durationDays).toBe(null);
  });

  it('refuses an unknown tier', () => {
    expect(() => decodeAdminPackage({ ...body, tier: 'GOLD' })).toThrow();
  });
});

describe('package form', () => {
  it('sends a new paid package with whole numbers', () => {
    const result = newPackageOf({
      ...newPackageDraft(),
      code: 'PRO_YEARLY',
      name: ' Pro yearly ',
      price: '990000',
      durationDays: '365',
    });
    expect(result).toEqual({
      ok: true,
      input: {
        code: 'PRO_YEARLY',
        name: 'Pro yearly',
        tier: 'PRO',
        price: 990000,
        durationDays: 365,
        purchasable: true,
      },
    });
  });

  it('refuses a code, price and duration outside the backend bounds', () => {
    const result = newPackageOf({
      ...newPackageDraft(),
      code: 'pro-1',
      name: 'x',
      price: '0',
      durationDays: '367',
    });
    expect(result).toEqual({
      ok: false,
      errors: { code: 'invalid', price: 'invalid', durationDays: 'invalid' },
    });
    expect(newPackageOf(newPackageDraft())).toMatchObject({
      ok: false,
      errors: { code: 'required', name: 'required', price: 'required' },
    });
  });

  it('types a stored price without its fraction', () => {
    expect(packageDraftOf(decodeAdminPackage(body)).price).toBe('99000');
  });

  it('sends only the name for the FREE package', () => {
    expect(
      packageChangeOf({ ...newPackageDraft(), name: 'Free' }, 'FREE'),
    ).toEqual({ ok: true, change: { name: 'Free' } });
  });
});

describe('tier limits form', () => {
  it('keeps an empty count as no limit and a 0 as zero', () => {
    const draft = { ...limitsDraftOf(limits), activePlanMax: '0' };
    expect(limitsOf(draft)).toEqual({
      ok: true,
      limits: { ...limits, activePlanMax: 0, watchlistMax: null },
    });
  });

  it('refuses a count past 100,000 and an empty AI quota', () => {
    const draft = {
      ...limitsDraftOf(limits),
      activeAlertMax: '100001',
      aiDailyQuota: '',
    };
    expect(limitsOf(draft)).toEqual({
      ok: false,
      errors: { activeAlertMax: true, aiDailyQuota: true },
    });
  });

  it('groups the packages by tier, a tier without one has no limits', () => {
    const groups = tierGroups([decodeAdminPackage(body)], ['FREE', 'PRO']);
    expect(groups[0]).toMatchObject({ tier: 'FREE', limits: null });
    expect(groups[1]?.packages).toHaveLength(1);
  });
});
