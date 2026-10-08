import type { PlanEntitlements, Session } from '../../types/domain';

/**
 * DEVELOPMENT ONLY (ADR-010). Labelled principals for building screens
 * before the auth integration is verified. Never real people or credentials.
 * The plan values mirror the documented seed tiers so gating can be exercised.
 */
export const DEV_PASSWORD = 'DevOnly-2026';

const free: PlanEntitlements = {
  tier: 'FREE',
  features: [],
  limits: {
    ACTIVE_PLAN_MAX: 3,
    WATCHLIST_MAX: 5,
    ACTIVE_ALERT_MAX: 3,
    AI_CHAT_DAILY: 0,
  },
};
const pro: PlanEntitlements = {
  tier: 'PRO',
  features: [
    'FUTURES_ANALYSIS',
    'SCORE_COMPONENTS',
    'INDICATOR_ALERT',
    'EXTERNAL_ALERT_CHANNELS',
    'ADVANCED_PERFORMANCE',
    'NEWS_AI_INSIGHT',
  ],
  limits: {
    ACTIVE_PLAN_MAX: null,
    WATCHLIST_MAX: 50,
    ACTIVE_ALERT_MAX: 20,
    AI_CHAT_DAILY: 30,
  },
};
const premium: PlanEntitlements = {
  tier: 'PREMIUM',
  features: [...pro.features, 'AI_PERFORMANCE_CONTEXT', 'VIDEO_POST'],
  limits: {
    ACTIVE_PLAN_MAX: null,
    WATCHLIST_MAX: 100,
    ACTIVE_ALERT_MAX: 50,
    AI_CHAT_DAILY: 100,
  },
};

function principal(
  id: string,
  email: string,
  displayName: string,
  role: 'Trader' | 'Admin',
  entitlements: Session['entitlements'],
): Session {
  return {
    user: { id, email, displayName, role, status: 'active' },
    entitlements,
  };
}

export const devPrincipals: readonly Session[] = [
  principal(
    'dev-free',
    'trader.free@dev.local',
    'Dev Trader Free',
    'Trader',
    free,
  ),
  principal('dev-pro', 'trader.pro@dev.local', 'Dev Trader Pro', 'Trader', pro),
  principal(
    'dev-premium',
    'trader.premium@dev.local',
    'Dev Trader Premium',
    'Trader',
    premium,
  ),
  principal('dev-admin', 'admin@dev.local', 'Dev Admin', 'Admin', 'unknown'),
];

/** Accounts that exist but cannot sign in, to exercise MSG10 and MSG11. */
export const devBlockedAccounts: Readonly<
  Record<string, 'LOCKED' | 'BANNED' | 'UNVERIFIED'>
> = {
  'locked@dev.local': 'LOCKED',
  'banned@dev.local': 'BANNED',
  'unverified@dev.local': 'UNVERIFIED',
};

/** Link tokens for SCR-03 / SCR-06 in development. */
export const DEV_TOKENS = {
  valid: 'dev-valid',
  alreadyVerified: 'dev-verified',
} as const;
