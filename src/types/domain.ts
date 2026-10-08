/**
 * Frontend domain vocabulary derived from the requirement baseline.
 * These are NOT approved backend wire schemas. Adapters must validate and map DTOs.
 * Financial decimal values remain strings until an agreed decimal calculation layer exists.
 */
export type Decimal = string;
export type ISODateTime = string;
export type MarketType = 'spot' | 'futures';
export type Role = 'Guest' | 'Trader' | 'Admin';
export type AccountRole = Exclude<Role, 'Guest'>;
/** Account status (SRS 3.2.3 / BR-06): LOCKED and BANNED accounts cannot sign in. */
export type AccountStatus = 'active' | 'locked' | 'banned';

export interface User {
  id: string;
  email: string;
  displayName: string;
  role: AccountRole;
  status: AccountStatus;
}
/** Subscription plan tiers (ADR-009). Package names and prices are backend data. */
export type PlanTier = 'FREE' | 'PRO' | 'PREMIUM';
/** Plan feature gates; which tier includes which is decided by the backend. */
export type PlanFeature =
  | 'FUTURES_ANALYSIS'
  | 'SCORE_COMPONENTS'
  | 'INDICATOR_ALERT'
  | 'EXTERNAL_ALERT_CHANNELS'
  | 'ADVANCED_PERFORMANCE'
  | 'NEWS_AI_INSIGHT'
  | 'AI_PERFORMANCE_CONTEXT'
  | 'VIDEO_POST';
/** Numeric plan limits. */
export type PlanLimit =
  'ACTIVE_PLAN_MAX' | 'WATCHLIST_MAX' | 'ACTIVE_ALERT_MAX' | 'AI_CHAT_DAILY';
export interface PlanEntitlements {
  tier: PlanTier;
  features: readonly PlanFeature[];
  /** null means unlimited; a missing key means not reported. */
  limits: Readonly<Partial<Record<PlanLimit, number | null>>>;
}
/**
 * 'unknown' while no backend source reports the caller's plan (FEQ-02):
 * the UI then gates nothing up front and relies on the server refusal.
 */
export type Entitlements = PlanEntitlements | 'unknown';
export interface Session {
  user: User;
  entitlements: Entitlements;
}
export interface MarketQuote {
  symbol: string;
  name: string;
  marketType: MarketType;
  price: Decimal;
  changePercent24h: Decimal;
  volume24h: Decimal;
  observedAt: ISODateTime;
}
export interface CoinAnalysis {
  symbol: string;
  marketType: MarketType;
  timeframe: string;
  observedAt: ISODateTime;
  indicators: ReadonlyArray<{ name: string; value: Decimal | null }>;
}
export interface TradingPlan {
  id: string;
  symbol: string;
  marketType: MarketType;
  entry: Decimal;
  stopLoss: Decimal | null;
  takeProfit: Decimal;
  capital: Decimal;
  leverage: Decimal;
}
export interface JournalEntry {
  id: string;
  planId: string;
  actualPnl: Decimal;
  notes: string;
  closedAt: ISODateTime;
}
export interface PriceAlert {
  id: string;
  symbol: string;
  marketType: MarketType;
  threshold: Decimal;
  triggeredAt: ISODateTime | null;
}
export interface CommunityPost {
  id: string;
  authorId: string;
  body: string;
  publishedAt: ISODateTime;
}
export interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  originalUrl: string;
  publishedAt: ISODateTime;
}
export interface AiConversation {
  id: string;
  title: string;
  updatedAt: ISODateTime;
}
export interface SubscriptionPackage {
  id: string;
  name: string;
  price: Decimal;
  currency: string;
  durationDays: number | null;
  tier: PlanTier;
}
export interface AdminLog {
  id: string;
  action: string;
  createdAt: ISODateTime;
}
