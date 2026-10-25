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
  /**
   * The id requests name the pair by (watchlist, alerts, plans, demo
   * orders); one id per symbol on both markets (FEQ-01).
   */
  pairId: string;
  symbol: string;
  market: MarketType;
  baseAsset: string | null;
  quoteAsset: string | null;
  baseAssetName: string | null;
  logoUrl: string | null;
  /** Price precision (CR-02); null until the exchange filters are synced. */
  tickSize: Decimal | null;
  /** Quantity increment; null until the exchange filters are synced. */
  stepSize: Decimal | null;
  /** Smallest order value in the quote asset; null until the filters are synced. */
  minNotional: Decimal | null;
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
  /** 24h volume in the base asset, e.g. BTC of BTCUSDT. */
  baseVolume24h: Decimal | null;
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
  /** Futures only (BR-13); absent on Spot. */
  derivatives?: Decimal | null;
}

/** Side whose evaluation gave the Futures score; not part of it (BR-13). */
export type DominantSide = 'LONG' | 'SHORT' | 'NEUTRAL';

export interface SetupScore {
  /** 0–100 integer; null = insufficient data (never shown as 0). */
  score: number | null;
  preset: SetupPreset;
  presetVersion: string;
  /** The preset's timeframe, which may differ from the chart's. */
  timeframe: CandleTimeframe;
  openTime: ISODateTime | null;
  components: ComponentScores;
  /** Futures only; null when the score is insufficient. */
  dominantSide?: DominantSide | null;
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

/** A stored 5-minute open interest point (NSF-04, BR-10). */
export interface OpenInterestPoint {
  time: ISODateTime;
  /** In contracts (base asset). */
  openInterest: Decimal;
  /** In the quote asset; null when the source gave none. */
  openInterestValue: Decimal | null;
}

/** A stored 5-minute global long/short account ratio point (BR-10). */
export interface LongShortPoint {
  time: ISODateTime;
  longShortRatio: Decimal;
  /** Fractions of accounts, e.g. "0.6481". */
  longAccountRatio: Decimal;
  shortAccountRatio: Decimal;
}

/** A settled funding (BR-11): rate as a fraction at the source's instant. */
export interface FundingSettlement {
  fundingTime: ISODateTime;
  fundingRate: Decimal;
  markPrice: Decimal | null;
}

/**
 * Futures metric series over `[from, to)`; sparse, no point assumed every
 * 5 minutes. `availableFrom` is the earliest stored point of each series
 * (null when none), used to state the available period (SRS 3.3.3).
 */
export interface FuturesMetrics {
  symbol: string;
  from: ISODateTime;
  to: ISODateTime;
  openInterest: readonly OpenInterestPoint[];
  longShortRatio: readonly LongShortPoint[];
  fundingSettlements: readonly FundingSettlement[];
  availableFrom: {
    openInterest: ISODateTime | null;
    longShortRatio: ISODateTime | null;
    fundingSettlements: ISODateTime | null;
  };
}
/**
 * Plan lifecycle (BR-32, BR-68): DRAFT → ACTIVE | CANCELLED; ACTIVE →
 * EXECUTED | CANCELLED | EXPIRED | INVALIDATED.
 */
export type PlanStatus =
  'DRAFT' | 'ACTIVE' | 'EXECUTED' | 'CANCELLED' | 'EXPIRED' | 'INVALIDATED';
/** SCR-16 tabs; the last one holds CANCELLED, EXPIRED and INVALIDATED. */
export type PlanTab = 'DRAFT' | 'ACTIVE' | 'EXECUTED' | 'CANCELLED_EXPIRED';
export type PlanDirection = 'LONG' | 'SHORT';
/** STOP is a stop-market breakout entry: `entryPrice` is the stop price (TP-A). */
export type PlanEntryType = 'LIMIT' | 'MARKET' | 'STOP';
/** What ended a waiting plan before its entry filled (BR-68, D-111). */
export type InvalidationReason =
  'TAKE_PROFIT_REACHED' | 'STOP_LOSS_REACHED' | 'INVALIDATION_PRICE';
export type WarningSeverity = 'INFO' | 'WARNING' | 'BLOCKING';
/**
 * BR-28, BR-29 (nine since D-116); the UI words each type itself. A type
 * this client does not know is kept as UNKNOWN with its severity, so one
 * new warning does not take a screen down (ADR-009).
 */
export type PlanWarningType =
  | 'INSUFFICIENT_CAPITAL'
  | 'SL_BEYOND_LIQUIDATION'
  | 'LOW_RR'
  | 'OVERSIZED_POSITION'
  | 'HIGH_LEVERAGE'
  | 'TOTAL_OPEN_RISK'
  | 'WIDE_STOP_LOSS'
  | 'HIGH_FUNDING_RATE'
  | 'HIGH_FEE_SHARE'
  | 'UNKNOWN';

export interface PlanWarning {
  type: PlanWarningType;
  severity: WarningSeverity;
  /** The type as the server sent it; only for UNKNOWN. */
  rawType?: string;
}

/**
 * Risk calculation stored with the plan (BR-31); Futures adds margin, MMR
 * and liquidation. The expected costs (TP-0, D-116) are null on a plan
 * saved before TP-0; funding and the liquidation clearance fee are not in
 * them.
 */
export interface PlanSnapshot {
  positionQuantity: Decimal;
  notionalValue: Decimal;
  initialMargin: Decimal | null;
  maintenanceMarginRateUsed: Decimal | null;
  riskAmount: Decimal;
  rewardAmount: Decimal;
  riskRewardRatio: Decimal;
  estimatedLiquidationPrice: Decimal | null;
  estimatedEntryFee: Decimal | null;
  estimatedStopLossExitFee: Decimal | null;
  estimatedTakeProfitExitFee: Decimal | null;
  estimatedSlippage: Decimal | null;
  /** "Real loss at stop loss": risk plus the fees and slippage. */
  lossAtStopLoss: Decimal | null;
  /** (lossAtStopLoss − riskAmount) / riskAmount, a fraction. */
  feeShareOfRisk: Decimal | null;
  /** "R:R after fees". */
  netRiskReward: Decimal | null;
}

export type PositionStatus = 'OPEN' | 'CLOSED';
export type CloseReason =
  'TAKE_PROFIT' | 'STOP_LOSS' | 'LIQUIDATION' | 'MANUAL';

/**
 * The position of an EXECUTED plan (T-048a; exits T-048b). The current
 * price and unrealized P/L (no fees, no funding, Q-55) are OPEN only and
 * null when no price is cached; the exit fields are CLOSED only.
 */
export interface PlanPosition {
  status: PositionStatus;
  /** Actual entry fill, slippage included. */
  fillPrice: Decimal;
  quantity: Decimal;
  entryTime: ISODateTime;
  entryFee: Decimal;
  /** Futures only. */
  liquidationPrice: Decimal | null;
  currentPrice: Decimal | null;
  unrealizedPnl: Decimal | null;
  exitPrice: Decimal | null;
  exitTime: ISODateTime | null;
  closeReason: CloseReason | null;
  /** Price result only (BR-35). */
  realizedPnl: Decimal | null;
  /** Entry fee + exit (or clearance) fee (BR-36). */
  feeAmount: Decimal | null;
  /** Signed funding so far, + received / − paid; null on Spot. */
  fundingFeeAmount: Decimal | null;
  /** realized − fees + funding (BR-38): the P/L to headline. */
  netPnl: Decimal | null;
  /** A funding settlement is still missing; the net may change. */
  provisional: boolean;
}

/**
 * A row of SCR-16. The pair is named by its id only, which the market lists
 * resolve to a symbol (FEQ-01); the P/L is not in the row.
 */
export interface TradingPlanSummary {
  id: string;
  pairId: string;
  market: MarketType;
  direction: PlanDirection;
  entryType: PlanEntryType;
  /** MARKET: the reference (planned) price. */
  entryPrice: Decimal;
  /** MARKET only: the price the quantity was sized on (TP-0). */
  expectedFillPrice: Decimal | null;
  stopLoss: Decimal;
  takeProfit: Decimal;
  /** Null on Spot. */
  leverage: number | null;
  riskAmount: Decimal;
  riskRewardRatio: Decimal;
  status: PlanStatus;
  createdAt: ISODateTime;
  activatedAt: ISODateTime | null;
  expiresAt: ISODateTime | null;
  invalidatedAt: ISODateTime | null;
  invalidationReason: InvalidationReason | null;
  /** OPEN / CLOSED on EXECUTED rows (T-048a), else null. */
  positionStatus: PositionStatus | null;
}

/** SCR-18: inputs, snapshot, warnings, status history and position of one plan. */
export interface TradingPlan {
  id: string;
  pairId: string;
  market: MarketType;
  direction: PlanDirection;
  entryType: PlanEntryType;
  /** MARKET: the reference price (= plannedEntryPrice). */
  entryPrice: Decimal;
  /** MARKET only: the price the quantity was sized on (TP-0). */
  expectedFillPrice: Decimal | null;
  /** Entered price (LIMIT, STOP) or reference price of the last save (MARKET). */
  plannedEntryPrice: Decimal | null;
  stopLoss: Decimal;
  takeProfit: Decimal;
  /** The profile's capital at the last save or at activation (TP-D). */
  capital: Decimal;
  riskPercent: Decimal;
  leverage: number | null;
  marginMode: 'ISOLATED' | null;
  expiresAt: ISODateTime | null;
  note: string | null;
  invalidationPrice: Decimal | null;
  maxEntryDeviationR: Decimal | null;
  analysisTimeframe: CandleTimeframe;
  status: PlanStatus;
  /** Set only with INVALIDATED. */
  invalidationReason: InvalidationReason | null;
  /** 0–100 taken at activation; null before it or when unreadable (never 0). */
  setupScoreAtPlan: Decimal | null;
  /** E.g. "DAY_TRADING v1"; null before activation. */
  setupScorePreset: string | null;
  /** True only for DRAFT. */
  editable: boolean;
  snapshot: PlanSnapshot;
  warnings: readonly PlanWarning[];
  blocksActivation: boolean;
  /** Oldest first. */
  statusHistory: readonly { status: PlanStatus; at: ISODateTime }[];
  /** Null until EXECUTED, and on a plan filled before T-048a. */
  position: PlanPosition | null;
}

/**
 * SCR-17 inputs (SRS 3.5.1, UC-16, UC-17). Editing replaces them whole;
 * the pair never changes. Null leaves a value to the server's default
 * (entry price for MARKET, risk % from the profile, a 7-day expiry for
 * LIMIT and STOP). The capital is always the profile's (TP-D, D-121).
 */
export interface PlanInputs {
  market: MarketType;
  /** LONG only on Spot (BR-21). */
  direction: PlanDirection;
  entryType: PlanEntryType;
  /** LIMIT: the limit price; STOP: the stop price; MARKET: null. */
  entryPrice: Decimal | null;
  stopLoss: Decimal;
  takeProfit: Decimal;
  riskPercent: Decimal | null;
  /** Futures only; null on Spot. */
  leverage: number | null;
  expiresAt: ISODateTime | null;
  note: string | null;
  /** LIMIT and STOP only. */
  invalidationPrice: Decimal | null;
  /** > 0 and at most the system block value. */
  maxEntryDeviationR: Decimal | null;
  analysisTimeframe: CandleTimeframe | null;
}

/** The live risk panel of SCR-17 (`POST /plans/calculate`); nothing is saved. */
export interface PlanCalculation {
  /** On the tick; for MARKET the current last price (the reference price). */
  entryPrice: Decimal;
  /** MARKET only: the reference moved by the slippage; null LIMIT/STOP. */
  expectedFillPrice: Decimal | null;
  /** The profile's default capital (TP-D). */
  capital: Decimal;
  riskPercent: Decimal;
  snapshot: PlanSnapshot;
  warnings: readonly PlanWarning[];
  blocksActivation: boolean;
}

/** SCR-19: what closing now would give (T-046 contract of 2026-10-25). */
export interface CloseEstimate {
  currentPrice: Decimal;
  /** The last price moved by the slippage, taker. */
  estimatedExitPrice: Decimal;
  priceResult: Decimal;
  entryFee: Decimal;
  estimatedExitFee: Decimal;
  /** Null on Spot. */
  fundingSoFar: Decimal | null;
  fundingProvisional: boolean;
  /** priceResult − entryFee − estimatedExitFee + fundingSoFar. */
  estimatedNetPnl: Decimal;
  at: ISODateTime;
}

/** MSG51 (400) and MSG52 (409) at a MARKET activation (TP-C). */
export interface EntryDeviation {
  deviationR: Decimal;
  maxDeviationR: Decimal;
  expectedFillPrice: Decimal;
  /** MSG51 only. */
  positionQuantity: Decimal | null;
  riskRewardRatio: Decimal | null;
  netRiskReward: Decimal | null;
  /** MSG52 only: the expected fill is at or past the take profit. */
  takeProfitReached: boolean;
}

export interface PlanListQuery {
  tab: PlanTab;
  /** One pair, by the id the market list gives (FEQ-01). */
  pairId?: string;
  market?: MarketType;
  /** Created at or after. */
  from?: ISODateTime;
  page: number;
  pageSize: number;
}

export interface PlanPage {
  items: readonly TradingPlanSummary[];
  page: number;
  pageSize: number;
  total: number;
}
export interface JournalEntry {
  id: string;
  planId: string;
  actualPnl: Decimal;
  notes: string;
  closedAt: ISODateTime;
}
/** A watched pair (SCR-12, SRS 3.4.1); prices and scores are not in the row (M-08). */
export interface WatchlistItem {
  id: string;
  pairId: string;
  symbol: string;
  /** Both false: an admin disabled the pair; kept, greyed and removable (Q-29). */
  spotListed: boolean;
  futuresListed: boolean;
  label: string | null;
  note: string | null;
  sortOrder: number;
  /** ACTIVE alerts only; MSG26 counts every alert of the row. */
  activeAlerts: number;
  addedAt: ISODateTime;
}
export interface Watchlist {
  /** Ordered by `sortOrder`, then `addedAt`. */
  items: readonly WatchlistItem[];
  /** WATCHLIST_MAX of the caller's plan; null = unlimited. */
  limit: number | null;
}
/** Absent = unchanged; an empty label or note clears it. */
export interface WatchlistItemUpdate {
  label?: string;
  note?: string;
  sortOrder?: number;
}

/** Alerts (SCR-13, SCR-14; SRS 3.4.2, 3.4.3, BR-17…BR-20). */
export type AlertType = 'PRICE' | 'INDICATOR';
export type AlertIndicator =
  | 'RSI_14'
  | 'MACD_CROSS'
  | 'EMA_CROSS'
  | 'FUNDING_RATE'
  | 'OPEN_INTEREST_CHANGE';
export type AlertCondition =
  'CROSS_ABOVE' | 'CROSS_BELOW' | 'GREATER_THAN' | 'LESS_THAN';
export type AlertTriggerMode = 'ONCE' | 'ONCE_PER_BAR' | 'EVERY_TIME';
export type AlertStatus = 'ACTIVE' | 'PAUSED' | 'TRIGGERED' | 'EXPIRED';
/** The rule a Trader enters; editing replaces it whole (the pair never changes). */
export interface AlertRule {
  market: MarketType;
  type: AlertType;
  indicator: AlertIndicator | null;
  /** RSI_14, MACD_CROSS, EMA_CROSS; the server sets 1h for the Futures indicators. */
  timeframe: CandleTimeframe | null;
  condition: AlertCondition;
  /** PRICE target (rounded to the tick by the server), RSI level or % change. */
  threshold: Decimal | null;
  triggerMode: AlertTriggerMode;
  /** Minutes; EVERY_TIME needs at least 1 (BR-19). */
  cooldownMinutes: number | null;
  notifyEmail: boolean;
  notifyPush: boolean;
  /** At most 90 days ahead. */
  expiresAt: ISODateTime | null;
}
export interface Alert extends AlertRule {
  id: string;
  watchlistId: string;
  pairId: string;
  symbol: string;
  status: AlertStatus;
  triggerCount: number;
  lastTriggeredAt: ISODateTime | null;
  createdAt: ISODateTime;
}
export interface AlertListQuery {
  status?: AlertStatus;
  type?: AlertType;
  page: number;
  pageSize: number;
}
export interface AlertPage {
  items: readonly Alert[];
  page: number;
  pageSize: number;
  total: number;
}
/** Community feed tabs (SRS 3.7.1); SAVED and MINE are the Trader's own. */
export type FeedTab = 'LATEST' | 'MOST_LIKED' | 'SAVED' | 'MINE';
/** HIDDEN shows only in the author's own views; DELETED never (BR-47). */
export type PostStatus = 'PUBLISHED' | 'HIDDEN' | 'DELETED';
export type PostType = 'TEXT' | 'VIDEO';
export type PostMediaKind = 'IMAGE' | 'VIDEO';
/** What an official post is (D-99). */
export type OfficialCategory = 'ANNOUNCEMENT' | 'PLATFORM_UPDATE' | 'EDUCATION';
export type ReportReason = 'SPAM' | 'SCAM' | 'ABUSE' | 'MISLEADING' | 'OTHER';

export interface PostAuthor {
  userId: string;
  /** null for an account without a profile. */
  displayName: string | null;
  avatarUrl: string | null;
}
export interface PostMedia {
  /** The key an edit names to keep the file. */
  publicId: string;
  kind: PostMediaKind;
  url: string;
  /** A still of a video; null for an image. */
  thumbnailUrl: string | null;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
}
interface PostBase {
  id: string;
  author: PostAuthor;
  title: string;
  postType: PostType;
  market: MarketType | null;
  /** Announcements are pinned above the feed (BR-61). */
  official: boolean;
  officialCategory: OfficialCategory | null;
  status: PostStatus;
  /** Coin symbols, alphabetical. */
  coins: readonly string[];
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
  savedByMe: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}
/** A feed card (SCR-24): the start of the text and the first media. */
export interface PostSummary extends PostBase {
  excerpt: string;
  cover: PostMedia | null;
}
/** A post as SCR-25 shows it. */
export interface PostDetail extends PostBase {
  content: string;
  media: readonly PostMedia[];
  /** The caller wrote it, so Edit and Delete are offered. */
  mine: boolean;
}
export interface PostPage {
  items: readonly PostSummary[];
  page: number;
  pageSize: number;
  total: number;
}
export interface FeedQuery {
  tab: FeedTab;
  coin?: string;
  market?: MarketType;
  /** Only the posts of this member (D-99). */
  author?: string;
  /** Search in titles and texts, 2–100 characters (D-99). */
  q?: string;
  page: number;
  pageSize: number;
}
/** A file uploaded for a post, named by its key (D-98). */
export interface PostMediaRef {
  publicId: string;
  kind: PostMediaKind;
}
/** The SCR-26 form: up to 4 images or 1 video (BR-44). */
export interface PostDraft {
  title: string;
  content: string;
  market: MarketType | null;
  coins: readonly string[];
  media: readonly PostMediaRef[];
  /** Set only on an official post, which only an Admin publishes (BR-61). */
  officialCategory?: OfficialCategory;
}
/** An official post of the administration console (UC-44, BR-61). */
export interface AnnouncementDraft extends PostDraft {
  officialCategory: OfficialCategory;
}
/**
 * A comment with its replies (one level, SRS 3.7.3). A deleted comment is
 * listed only while it has replies, without its text or author.
 */
export interface PostComment {
  id: string;
  postId: string;
  parentCommentId: string | null;
  author: PostAuthor | null;
  content: string | null;
  deleted: boolean;
  likeCount: number;
  likedByMe: boolean;
  mine: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  replies: readonly PostComment[];
}
export interface CommentPage {
  items: readonly PostComment[];
  page: number;
  pageSize: number;
  total: number;
}
/** Where a like or save stands after a click (BR-45). */
export interface Engagement {
  active: boolean;
  count: number;
}
export interface PostReport {
  reason: ReportReason;
  /** Required for OTHER, at most 500 characters. */
  description: string | null;
}
/** How much the community talks about a coin (D-99). */
export interface CoinDiscussion {
  symbol: string;
  name: string;
  postsLastDay: number;
  postsLastWeek: number;
  totalPosts: number;
  lastPostAt: ISODateTime | null;
}
/** A member's public page (D-99); nothing of their trading. */
export interface MemberProfile {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  joinedAt: ISODateTime;
  posts: number;
  likesReceived: number;
  me: boolean;
}
/** Where a report stands (SRS 3.11.3): filed, opened by a moderator, decided. */
export type ReportStatus = 'OPEN' | 'REVIEWING' | 'RESOLVED';
/**
 * A moderator's decision on all open reports of a post (UC-43); REMOVE_POST
 * deletes it for everyone but Admin (D-99).
 */
export type ModerationAction =
  'HIDE_POST' | 'REMOVE_POST' | 'DISMISS' | 'WARN_USER' | 'BAN_USER';
/** One post of the SCR-36 queue with its open reports gathered. */
export interface ModerationQueueItem {
  post: PostSummary;
  reportCount: number;
  reasons: readonly ReportReason[];
  firstReportedAt: ISODateTime;
  lastReportedAt: ISODateTime;
}
export interface ModerationQueuePage {
  items: readonly ModerationQueueItem[];
  page: number;
  pageSize: number;
  total: number;
}
export interface ModerationReport {
  id: string;
  reporter: PostAuthor;
  reason: ReportReason;
  description: string | null;
  status: ReportStatus;
  createdAt: ISODateTime;
}
/** A reported post as a moderator opens it; its reports become REVIEWING. */
export interface ModerationCase {
  post: PostDetail;
  reports: readonly ModerationReport[];
}
export interface ModerationResult {
  postId: string;
  action: ModerationAction;
  postStatus: PostStatus;
  resolvedReports: number;
  /** True when this decision banned the author (not one banned before). */
  authorBanned: boolean;
}
/** What a notification is about (SRS 3.4.5; COMMENT from SRS 3.7.3). */
export type NotificationType =
  'ALERT' | 'PLAN' | 'MODERATION' | 'SUBSCRIPTION' | 'COMMENT';
/** What opening a notification navigates to (SRS 3.4.5). */
export type NotificationReferenceType =
  'ALERT' | 'PLAN' | 'POST' | 'SUBSCRIPTION';
/** One entry of the notification center (SCR-15, UC-15). */
export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  content: string;
  reference: { type: NotificationReferenceType; id: string } | null;
  read: boolean;
  readAt: ISODateTime | null;
  createdAt: ISODateTime;
}
export interface NotificationPage {
  items: readonly AppNotification[];
  page: number;
  pageSize: number;
  total: number;
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

/**
 * Demo trading (D-86): the Trader's paper account, virtual funds only;
 * nothing reaches an exchange. How Futures positions are held (Q-T4).
 */
export type PaperPositionMode = 'one-way' | 'hedge';
export interface PaperAccount {
  accountId: string;
  positionMode: PaperPositionMode;
  openedAt: ISODateTime;
}

/** A paper wallet: Spot holds coins, Futures USDT only (USDⓈ-M, TR-04). */
export type PaperWalletType = 'SPOT' | 'FUTURES';
export interface PaperBalance {
  coinId: string;
  asset: string;
  free: Decimal;
  /** Held by working orders. */
  locked: Decimal;
  total: Decimal;
  /** Valued at the Spot last price; null without a current price. */
  usdtValue: Decimal | null;
}
/**
 * One coin of the Spot wallet with its cost and worth (TR-13), as the
 * exchange's Spot PnL shows it; each null when the backend does not know it.
 */
export interface CoinPnl {
  coinId: string;
  asset: string;
  /** Free plus locked. */
  quantity: Decimal;
  /** Of one unit, in USDT. */
  averageCost: Decimal | null;
  costBasis: Decimal | null;
  lastPrice: Decimal | null;
  value: Decimal | null;
  unrealizedPnl: Decimal | null;
  /** 2 decimals; null with no cost or a zero cost. */
  unrealizedPnlPercent: Decimal | null;
}
/** The Spot wallet's coins, largest value first; USDT is not listed. */
export interface SpotPnl {
  coins: readonly CoinPnl[];
  totalValue: Decimal;
  totalUnrealizedPnl: Decimal;
  /** False when a coin had no cost or price: the sums leave it out. */
  complete: boolean;
}
/** The account at the start of one UTC day. */
export interface PaperEquityPoint {
  /** `YYYY-MM-DD`, UTC. */
  date: string;
  spotEquity: Decimal;
  futuresEquity: Decimal;
  totalEquity: Decimal;
}
/** What the demo account is worth now and was worth each day (TR-13). */
export interface PaperEquity {
  spotEquity: Decimal;
  futuresEquity: Decimal;
  totalEquity: Decimal;
  /** Now less the day's snapshot; null while the day has none. */
  todayPnl: Decimal | null;
  todayPnlPercent: Decimal | null;
  /** Oldest first. */
  history: readonly PaperEquityPoint[];
}
/** A balance that moved, as the account's push names it (TR-08). */
export interface PaperBalanceUpdate {
  wallet: PaperWalletType;
  coinId: string;
  asset: string;
  free: Decimal;
  locked: Decimal;
  total: Decimal;
}
/**
 * What a committed change of the caller's demo account pushes (TR-08): each
 * order whose state changed, each new fill, each balance that moved.
 */
export type PaperAccountEvent =
  | { kind: 'order'; order: PaperOrder }
  | { kind: 'fill'; fill: PaperFill }
  | { kind: 'balance'; balance: PaperBalanceUpdate };
export interface PaperWallet {
  wallet: PaperWalletType;
  /** Largest value first. */
  balances: readonly PaperBalance[];
  estimatedUsdt: Decimal;
  estimatedBtc: Decimal | null;
  /** False when some balance had no price, so the estimates leave it out. */
  complete: boolean;
}
export interface PaperTransfer {
  transferId: string;
  clientTransferId: string;
  asset: string;
  from: PaperWalletType;
  to: PaperWalletType;
  amount: Decimal;
  transferredAt: ISODateTime;
}
export type OrderSide = 'BUY' | 'SELL';
/**
 * The Spot order types of the exchange's Spot API (STOP_LOSS and
 * TAKE_PROFIT execute at the market once triggered, the _LIMIT kinds work
 * as a limit; LIMIT_MAKER is the post-only order).
 */
export type SpotOrderType =
  | 'MARKET'
  | 'LIMIT'
  | 'LIMIT_MAKER'
  | 'STOP_LOSS'
  | 'STOP_LOSS_LIMIT'
  | 'TAKE_PROFIT'
  | 'TAKE_PROFIT_LIMIT';
/** Every type the backend knows: the Spot ones, and those of Futures. */
export type PaperOrderType =
  | SpotOrderType
  | 'STOP'
  | 'STOP_MARKET'
  | 'TAKE_PROFIT_MARKET'
  | 'TRAILING_STOP_MARKET';
/** GTX is the post-only of Futures; Spot takes GTC, IOC and FOK. */
export type TimeInForce = 'GTC' | 'IOC' | 'FOK' | 'GTX';
export type PaperOrderStatus =
  | 'NEW'
  | 'PENDING_NEW'
  | 'PARTIALLY_FILLED'
  | 'FILLED'
  | 'CANCELED'
  | 'EXPIRED'
  | 'REJECTED';
export interface PaperOrder {
  orderId: string;
  clientOrderId: string;
  pairId: string;
  symbol: string;
  market: MarketType;
  side: OrderSide;
  type: PaperOrderType;
  timeInForce: TimeInForce | null;
  /** LIMIT only. */
  price: Decimal | null;
  /** Null for a MARKET buy by total. */
  quantity: Decimal | null;
  /** MARKET buy by total only: what it spends. */
  quoteOrderQty: Decimal | null;
  executedQuantity: Decimal;
  /** What the executions cost or brought, before fees. */
  cumQuote: Decimal;
  avgPrice: Decimal | null;
  status: PaperOrderStatus;
  /** Why it ended other than by filling, e.g. NOT_FILLABLE_ON_ARRIVAL. */
  statusReason: string | null;
  placedAt: ISODateTime;
  closedAt: ISODateTime | null;
  /** A stop's stopPrice: its trigger, or where a trailing stop starts. */
  stopPrice?: Decimal | null;
  /** A trailing stop's delta in basis points (100 = 1 %). */
  trailingDelta?: number | null;
  /** When a stop triggered. */
  triggeredAt?: ISODateTime | null;
  /** The OCO, OTO or OTOCO it belongs to. */
  listId?: string | null;
}
export interface PaperFill {
  fillId: string;
  orderId: string;
  pairId: string;
  symbol: string;
  market: MarketType;
  side: OrderSide;
  price: Decimal;
  quantity: Decimal;
  quoteAmount: Decimal;
  fee: Decimal;
  feeAsset: string;
  liquidity: 'MAKER' | 'TAKER';
  /** REPLAY: decided by candles replayed after a restart (Q-T6). */
  source: 'LIVE' | 'REPLAY';
  tradedAt: ISODateTime;
}
/**
 * A Spot order to place, as the exchange's Spot API takes it. LIMIT:
 * price and quantity, GTC unless IOC or FOK. LIMIT_MAKER: price and
 * quantity, refused if it would fill at once. MARKET: quantity, or the
 * quote amount to spend (BUY) or receive (SELL). STOP_LOSS / TAKE_PROFIT:
 * quantity and a stopPrice and/or trailingDelta; the _LIMIT kinds also a
 * price. The `clientOrderId` is the idempotency key: keep it when sending
 * again.
 */
export interface PlacePaperOrder {
  pairId: string;
  market: MarketType;
  side: OrderSide;
  type: SpotOrderType;
  timeInForce?: 'GTC' | 'IOC' | 'FOK';
  price?: Decimal;
  quantity?: Decimal;
  quoteOrderQty?: Decimal;
  stopPrice?: Decimal;
  /** Basis points, 10 to 2000 (0.1 % to 20 %). */
  trailingDelta?: number;
  clientOrderId: string;
}
export type PaperOrderListType = 'OCO' | 'OTO' | 'OTOCO';
/** One order of an OTO or OTOCO. */
export interface PaperOrderListLeg {
  side: OrderSide;
  type: SpotOrderType;
  price?: Decimal;
  stopPrice?: Decimal;
  quantity: Decimal;
}
/** The take profit (LIMIT_MAKER) and stop of an OCO, on one side and quantity. */
export interface PaperOcoLegs {
  side: OrderSide;
  /**
   * Required for an OCO. Absent in an OTOCO, the backend takes what the
   * working order leaves once its fee is paid.
   */
  quantity?: Decimal;
  takeProfitPrice: Decimal;
  stopPrice: Decimal;
  /** Absent: the stop is a STOP_LOSS, executed at the market. */
  stopLimitPrice?: Decimal;
}
/**
 * A group of Spot orders to place together: OCO (`oco`), OTO (`working`
 * and `pending`), OTOCO (`working` and `oco`, a limit with TP/SL).
 */
export interface PlacePaperOrderList {
  pairId: string;
  market: MarketType;
  type: PaperOrderListType;
  working?: PaperOrderListLeg;
  pending?: PaperOrderListLeg;
  oco?: PaperOcoLegs;
  /**
   * The idempotency key, as `clientOrderId` for one order: the same group
   * sent again with the same key returns the group already placed.
   */
  listClientOrderId?: string;
}
export interface PaperOrderList {
  listId: string;
  type: PaperOrderListType;
  status: 'EXECUTING' | 'ALL_DONE' | 'REJECTED';
  pairId: string;
  symbol: string;
  /** The working order first, then the take profit and the stop. */
  orders: readonly PaperOrder[];
}
export interface PaperPage<T> {
  items: readonly T[];
  page: number;
  pageSize: number;
  total: number;
}
export interface PaperHistoryQuery {
  /** One pair; every pair when absent. */
  pairId?: string;
  /** Order history only: one status. */
  status?: PaperOrderStatus;
  /** At or after / before, ISO 8601 UTC. */
  from?: ISODateTime;
  to?: ISODateTime;
  page: number;
  pageSize: number;
}
/** What changed a paper balance (TR-04 ledger). */
export type PaperLedgerType =
  | 'INITIAL_GRANT'
  | 'TRADE'
  | 'FEE'
  | 'REALIZED_PNL'
  | 'FUNDING_FEE'
  | 'TRANSFER'
  | 'LIQUIDATION_FEE';
/** One change of a balance: the transaction history. */
export interface PaperLedgerEntry {
  entryId: string;
  wallet: PaperWalletType;
  asset: string;
  type: PaperLedgerType;
  /** Signed: negative leaves the balance. */
  amount: Decimal;
  /** The balance's total after it. */
  balanceAfter: Decimal;
  refType:
    'ORDER' | 'FILL' | 'POSITION' | 'TRANSFER' | 'FUNDING' | 'ACCOUNT' | null;
  refId: string | null;
  createdAt: ISODateTime;
}
export interface PaperLedgerQuery {
  wallet?: PaperWalletType;
  type?: PaperLedgerType;
  from?: ISODateTime;
  to?: ISODateTime;
  page: number;
  pageSize: number;
}

/** One level of an order book: a price and the base quantity resting there. */
export interface OrderBookLevel {
  price: Decimal;
  quantity: Decimal;
}
/**
 * The top levels of a pair's book (TR-03, exchange depth20): bids highest
 * first, asks lowest first. A newer `lastUpdateId` replaces an older book;
 * both sides are empty and the id null when no current depth is held.
 */
export interface OrderBook {
  market: MarketType;
  symbol: string;
  lastUpdateId: number | null;
  receivedAt: ISODateTime;
  bids: readonly OrderBookLevel[];
  asks: readonly OrderBookLevel[];
}
/** One aggregated market trade; `buyerMaker` means the taker sold. */
export interface MarketTrade {
  id: number;
  price: Decimal;
  quantity: Decimal;
  time: ISODateTime;
  buyerMaker: boolean;
}
