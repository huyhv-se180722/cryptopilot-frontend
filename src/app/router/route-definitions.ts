import type { Copy } from '../../i18n/locales/en';

/**
 * Route metadata is UI configuration, never business data.
 * `screen` traces each route to the SRS screen inventory (SCR-01…44);
 * demo trading is not in SRS v1.0 and traces to its decision D-86 (D-101).
 * Dialog screens (SCR-14, SCR-19, SCR-27) have no route of their own.
 */
export type ScreenId = `SCR-${string}` | 'D-86';
export type ScreenTitleKey = keyof Copy['screens'];

export interface RouteDefinition {
  readonly path: string;
  readonly screen: ScreenId;
  readonly titleKey: ScreenTitleKey;
}

export interface RouteHandle {
  readonly screen: ScreenId;
  readonly titleKey: ScreenTitleKey;
}

/** Reachable by everyone (SRS 3.1.3). */
export const publicRoutes = [
  { path: '/', screen: 'SCR-01', titleKey: 'publicHome' },
] as const satisfies readonly RouteDefinition[];

/** Guests only; signed-in users are sent to their home. */
export const guestOnlyRoutes = [
  { path: '/register', screen: 'SCR-02', titleKey: 'register' },
  { path: '/verify-email', screen: 'SCR-03', titleKey: 'verifyEmail' },
  { path: '/login', screen: 'SCR-04', titleKey: 'login' },
  { path: '/forgot-password', screen: 'SCR-05', titleKey: 'forgotPassword' },
  { path: '/reset-password', screen: 'SCR-06', titleKey: 'resetPassword' },
] as const satisfies readonly RouteDefinition[];

export const traderRoutes = [
  { path: '/dashboard', screen: 'SCR-08', titleKey: 'dashboard' },
  { path: '/markets', screen: 'SCR-09', titleKey: 'markets' },
  { path: '/markets/spot/:symbol', screen: 'SCR-10', titleKey: 'spotAnalysis' },
  {
    path: '/markets/futures/:symbol',
    screen: 'SCR-11',
    titleKey: 'futuresAnalysis',
  },
  { path: '/watchlist', screen: 'SCR-12', titleKey: 'watchlist' },
  { path: '/alerts', screen: 'SCR-13', titleKey: 'alerts' },
  { path: '/notifications', screen: 'SCR-15', titleKey: 'notifications' },
  { path: '/plans', screen: 'SCR-16', titleKey: 'plans' },
  { path: '/plans/new', screen: 'SCR-17', titleKey: 'planNew' },
  { path: '/plans/:planId', screen: 'SCR-18', titleKey: 'planDetail' },
  { path: '/plans/:planId/edit', screen: 'SCR-17', titleKey: 'planEdit' },
  { path: '/journal', screen: 'SCR-20', titleKey: 'journal' },
  { path: '/journal/new', screen: 'SCR-22', titleKey: 'journalManual' },
  { path: '/journal/:entryId', screen: 'SCR-21', titleKey: 'journalEntry' },
  { path: '/performance', screen: 'SCR-23', titleKey: 'performance' },
  { path: '/community', screen: 'SCR-24', titleKey: 'community' },
  { path: '/community/new', screen: 'SCR-26', titleKey: 'postNew' },
  { path: '/community/:postId', screen: 'SCR-25', titleKey: 'postDetail' },
  { path: '/community/:postId/edit', screen: 'SCR-26', titleKey: 'postEdit' },
  { path: '/news', screen: 'SCR-28', titleKey: 'news' },
  { path: '/ai', screen: 'SCR-29', titleKey: 'ai' },
  { path: '/subscription', screen: 'SCR-30', titleKey: 'subscription' },
  {
    path: '/subscription/payment-result',
    screen: 'SCR-31',
    titleKey: 'paymentResult',
  },
  {
    path: '/subscription/payments',
    screen: 'SCR-32',
    titleKey: 'paymentHistory',
  },
  { path: '/profile', screen: 'SCR-07', titleKey: 'profile' },
] as const satisfies readonly RouteDefinition[];

/** Demo trading (D-86), registered only behind its flag (D-101). */
export const paperRoutes = [
  { path: '/trade/spot', screen: 'D-86', titleKey: 'tradeSpot' },
  { path: '/trade/spot/:symbol', screen: 'D-86', titleKey: 'tradeSpot' },
  { path: '/trade/wallet', screen: 'D-86', titleKey: 'tradeWallet' },
  { path: '/trade/orders', screen: 'D-86', titleKey: 'tradeOrders' },
] as const satisfies readonly RouteDefinition[];

export const adminRoutes = [
  { path: '/admin', screen: 'SCR-33', titleKey: 'adminDashboard' },
  { path: '/admin/users', screen: 'SCR-34', titleKey: 'adminUsers' },
  { path: '/admin/users/:userId', screen: 'SCR-35', titleKey: 'adminUser' },
  { path: '/admin/reports', screen: 'SCR-36', titleKey: 'adminReports' },
  { path: '/admin/pairs', screen: 'SCR-37', titleKey: 'adminPairs' },
  {
    path: '/admin/leverage-brackets',
    screen: 'SCR-38',
    titleKey: 'adminBrackets',
  },
  { path: '/admin/packages', screen: 'SCR-39', titleKey: 'adminPackages' },
  { path: '/admin/payments', screen: 'SCR-40', titleKey: 'adminPayments' },
  {
    path: '/admin/news-sources',
    screen: 'SCR-41',
    titleKey: 'adminNewsSources',
  },
  { path: '/admin/ai-config', screen: 'SCR-42', titleKey: 'adminAiConfig' },
  { path: '/admin/settings', screen: 'SCR-43', titleKey: 'adminSettings' },
  { path: '/admin/audit-log', screen: 'SCR-44', titleKey: 'adminAuditLog' },
  { path: '/admin/account', screen: 'SCR-07', titleKey: 'adminAccount' },
] as const satisfies readonly RouteDefinition[];

export const DIALOG_SCREENS: readonly ScreenId[] = [
  'SCR-14',
  'SCR-19',
  'SCR-27',
];

export function toHandle(route: RouteDefinition): RouteHandle {
  return { screen: route.screen, titleKey: route.titleKey };
}

export function isRouteHandle(value: unknown): value is RouteHandle {
  return (
    typeof value === 'object' &&
    value !== null &&
    'screen' in value &&
    'titleKey' in value
  );
}
