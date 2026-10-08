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
/** A pair enabled by Admin on one market, in admin display order (BR-07). */
export interface MarketPair {
  symbol: string;
  market: MarketType;
  baseAsset: string | null;
  quoteAsset: string | null;
  baseAssetName: string | null;
  logoUrl: string | null;
  /** Price precision (CR-02); null until the exchange filters are synced. */
  tickSize: Decimal | null;
  displayOrder: number;
}

/**
 * Latest ticker of a pair. Spot carries last price and 24h statistics;
 * Futures carries mark, index and funding only (no 24h data, M-09).
 */
export interface MarketTicker {
  market: MarketType;
  symbol: string;
  /** Exchange event time (stream) or snapshot time (REST fallback). */
  sourceTime: ISODateTime;
  lastPrice: Decimal | null;
  bestBid: Decimal | null;
  bestAsk: Decimal | null;
  high24h: Decimal | null;
  low24h: Decimal | null;
  /** Already a percent, e.g. "1.25". */
  changePercent24h: Decimal | null;
  quoteVolume24h: Decimal | null;
  markPrice: Decimal | null;
  indexPrice: Decimal | null;
  /** A fraction: "0.0001" is 0.01 %. */
  fundingRate: Decimal | null;
  nextFundingTime: ISODateTime | null;
}

export interface MarketOverview {
  market: MarketType;
  serverTime: ISODateTime;
  tickers: readonly MarketTicker[];
}

export type CandleTimeframe = '15m' | '1h' | '4h' | '1d';

/** A candle; prices stay decimal strings. */
export interface Candle {
  openTime: ISODateTime;
  open: Decimal;
  high: Decimal;
  low: Decimal;
  close: Decimal;
  /** Volume in the base asset (the Volume panel and its SMA20, BR-12). */
  baseVolume: Decimal;
  quoteVolume: Decimal;
}

/**
 * A candle as the stream reports it (`/topic/kline.*`): `closed: false`
 * is the forming candle, drawn as provisional (SRS 3.3.2).
 */
export interface KlineUpdate {
  market: MarketType;
  symbol: string;
  timeframe: CandleTimeframe;
  closed: boolean;
  candle: Candle;
}
/** Style preset the setup score is read with (D-53); its timeframe in the score. */
export type SetupPreset = 'SCALPING' | 'DAY_TRADING' | 'SWING';

/** Component scores 0–100 (BR-13); null where history is insufficient. */
export interface ComponentScores {
  formulaVersion: string | null;
  trend: Decimal | null;
  momentum: Decimal | null;
  volume: Decimal | null;
  level: Decimal | null;
}

export interface SetupScore {
  /** 0–100 integer; null = insufficient data (never shown as 0). */
  score: number | null;
  preset: SetupPreset;
  presetVersion: string;
  /** The preset's timeframe, which may differ from the chart's. */
  timeframe: CandleTimeframe;
  openTime: ISODateTime | null;
  components: ComponentScores;
}

export type IndicatorName =
  | 'sma20'
  | 'ema20'
  | 'ema50'
  | 'ema200'
  | 'rsi14'
  | 'macdLine'
  | 'macdSignal'
  | 'macdHistogram'
  | 'bbUpper'
  | 'bbMiddle'
  | 'bbLower'
  | 'volumeSma20';

/** `GET /analysis/{market}/{symbol}` of one timeframe (UC-10). */
export interface PairAnalysis {
  symbol: string;
  market: MarketType;
  timeframe: CandleTimeframe;
  /** Candle the values belong to; null = no data yet. */
  openTime: ISODateTime | null;
  indicators: Readonly<Record<IndicatorName, Decimal | null>>;
  /** BR-14 swing levels; null when none. */
  nearestSupport: Decimal | null;
  nearestResistance: Decimal | null;
  setupScore: SetupScore;
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

/** Profile & Settings (SCR-07, SRS 3.2.5). */
export type TradingStyle = 'SCALPING' | 'DAY' | 'SWING' | 'POSITION';
export type RiskProfile = 'CONSERVATIVE' | 'BALANCED' | 'AGGRESSIVE';
export interface UserProfile {
  email: string;
  displayName: string;
  avatarUrl: string | null;
  defaultCapital: Decimal | null;
  defaultRiskPercent: Decimal | null;
  tradingStyle: TradingStyle | null;
  riskProfile: RiskProfile;
  notifyEmail: boolean;
  notifyPush: boolean;
}
/** Full replacement of the profile fields (fields left null are cleared). */
export interface ProfileUpdate {
  displayName: string;
  defaultCapital: Decimal | null;
  defaultRiskPercent: Decimal | null;
  tradingStyle: TradingStyle | null;
}
/** Parameters of a risk profile (BR-66). */
export interface RiskProfileParams {
  riskProfile: RiskProfile;
  riskPerTradePercent: Decimal;
  maxFuturesLeverage: number;
  maxTotalOpenRiskPercent: Decimal;
}
export interface RiskQuestion {
  code: string;
  group: 'CAPACITY' | 'ATTITUDE';
  text: string;
  options: readonly { code: string; text: string }[];
}
/** Questionnaire result: a suggestion only, nothing is saved (BR-67). */
export interface RiskSuggestion {
  capacityScore: number;
  attitudeScore: number;
  suggestedProfile: RiskProfile;
}
