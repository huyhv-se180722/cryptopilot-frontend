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
 * Plan lifecycle (BR-32): DRAFT → ACTIVE | CANCELLED; ACTIVE → EXECUTED |
 * CANCELLED | EXPIRED | INVALIDATED (BR-68, D-111).
 */
export type PlanStatus =
  'DRAFT' | 'ACTIVE' | 'EXECUTED' | 'CANCELLED' | 'EXPIRED' | 'INVALIDATED';
/** SCR-16 tabs; the last one holds CANCELLED, EXPIRED and INVALIDATED. */
export type PlanTab = 'DRAFT' | 'ACTIVE' | 'EXECUTED' | 'CANCELLED_EXPIRED';
export type PlanDirection = 'LONG' | 'SHORT';
/** STOP: a stop-market entry for breakouts, `entryPrice` its stop (D-111). */
export type PlanEntryType = 'LIMIT' | 'MARKET' | 'STOP';
/** The timeframe a plan was analysed on (BR-70, D-112). */
export type PlanTimeframe = '15m' | '1h' | '4h' | '1d';
/** Why a waiting plan became INVALIDATED (BR-68). */
export type PlanInvalidationReason =
  'TAKE_PROFIT_REACHED' | 'STOP_LOSS_REACHED' | 'INVALIDATION_PRICE';
export type WarningSeverity = 'INFO' | 'WARNING' | 'BLOCKING';
/** BR-28, BR-29; the UI words each type itself. */
export type PlanWarningType =
  | 'INSUFFICIENT_CAPITAL'
  | 'SL_BEYOND_LIQUIDATION'
  | 'LOW_RR'
  | 'OVERSIZED_POSITION'
  | 'HIGH_LEVERAGE'
  | 'TOTAL_OPEN_RISK'
  | 'WIDE_STOP_LOSS'
  | 'HIGH_FUNDING_RATE'
  | 'HIGH_FEE_SHARE';

export interface PlanWarning {
  type: PlanWarningType;
  severity: WarningSeverity;
}

/** Risk calculation stored with the plan (BR-31); Futures adds margin, MMR and liquidation. */
export interface PlanSnapshot {
  positionQuantity: Decimal;
  notionalValue: Decimal;
  initialMargin: Decimal | null;
  maintenanceMarginRateUsed: Decimal | null;
  riskAmount: Decimal;
  rewardAmount: Decimal;
  riskRewardRatio: Decimal;
  estimatedLiquidationPrice: Decimal | null;
  /**
   * Expected trading costs (BR-29, D-116), read from each answer and never
   * computed here; all null on a plan saved before the backend had them.
   * Funding and the liquidation fee are not in them.
   */
  estimatedEntryFee: Decimal | null;
  estimatedStopLossExitFee: Decimal | null;
  estimatedTakeProfitExitFee: Decimal | null;
  estimatedSlippage: Decimal | null;
  /** The risk amount plus the costs of a stop loss exit. */
  lossAtStopLoss: Decimal | null;
  /** The costs over the risk amount, a fraction ("0.19950000"). */
  feeShareOfRisk: Decimal | null;
  /** The reward over the real loss, both after costs. */
  netRiskReward: Decimal | null;
}

/**
 * A row of SCR-16. The pair is named by its id only, which the market lists
 * resolve to a symbol (FEQ-01).
 */
export interface TradingPlanSummary {
  id: string;
  pairId: string;
  market: MarketType;
  direction: PlanDirection;
  entryType: PlanEntryType;
  entryPrice: Decimal;
  /**
   * MARKET only: the reference price moved by the configured slippage, the
   * price the quantity is sized on (D-112); null for LIMIT and STOP.
   */
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
  invalidationReason: PlanInvalidationReason | null;
  /** EXECUTED rows only (T-048a); null otherwise and for a plan filled before. */
  positionStatus: PositionStatus | null;
}

export type PositionStatus = 'OPEN' | 'CLOSED';
/** How a position ended (BR-35, BR-37, UC-21). */
export type PositionCloseReason =
  'TAKE_PROFIT' | 'STOP_LOSS' | 'MANUAL' | 'LIQUIDATION';

/** One change of the levels of an open position (D-124), oldest first. */
export interface PositionLevelChange {
  changedAt: ISODateTime;
  oldStopLoss: Decimal | null;
  oldTakeProfit: Decimal | null;
  newStopLoss: Decimal | null;
  newTakeProfit: Decimal | null;
}

/**
 * The simulated position of an EXECUTED plan (SCR-18, UC-20, BR-34…BR-38).
 * Every amount is the server's: the UI never computes P/L or fees (D-97).
 */
export interface PlanPosition {
  status: PositionStatus;
  /** The entry as filled, slippage included. */
  fillPrice: Decimal;
  quantity: Decimal;
  entryTime: ISODateTime;
  entryFee: Decimal;
  /** Futures, at the fill price; null on Spot. */
  liquidationPrice: Decimal | null;
  /** OPEN only: Futures mark, Spot last price; null when not cached. */
  currentPrice: Decimal | null;
  /** OPEN only: by the current price, no fees and no funding (Q-55). */
  unrealizedPnl: Decimal | null;
  /** CLOSED only from here to `provisional`. */
  exitPrice: Decimal | null;
  exitTime: ISODateTime | null;
  closeReason: PositionCloseReason | null;
  /** The price result, no fees, no funding (BR-35). */
  realizedPnl: Decimal | null;
  /** Entry and exit fee, or the clearance fee of a liquidation (BR-36). */
  feeAmount: Decimal | null;
  /** Futures: + received / − paid so far; null on Spot. */
  fundingFeeAmount: Decimal | null;
  /** The headline P/L: realized − fees + funding (BR-38). */
  netPnl: Decimal | null;
  /** A funding settlement may still change `netPnl`. */
  provisional: boolean;
  /** The levels the exits use now (D-124); null from a backend before TP-E. */
  stopLoss: Decimal | null;
  takeProfit: Decimal | null;
  /** The levels at the fill; never change. */
  originalStopLoss: Decimal | null;
  originalTakeProfit: Decimal | null;
  /** A stop loss was once moved further from the entry than the original. */
  stopWidened: boolean;
  levelChangeCount: number;
  levelChanges: readonly PositionLevelChange[];
  /** OPEN only: the stop at which the net P/L is about zero. */
  breakevenPrice: Decimal | null;
  breakevenProvisional: boolean;
  /** Only in the answer of a change: the risk limits a widened stop breaks. */
  levelWarnings: readonly PlanWarning[];
  /** The first 1-minute candle the current levels act on; null if never changed. */
  levelsEffectiveFrom: ISODateTime | null;
}

/**
 * A MARKET activation refused for the entry's move since the last save
 * (BR-69, TP-C), in R (positive = worse): MSG51 asks to confirm with the
 * re-sized plan; MSG52 refuses (beyond the limit or past the take profit).
 */
export type EntryDeviation =
  | {
      kind: 'confirm';
      deviationR: Decimal;
      maxDeviationR: Decimal;
      expectedFillPrice: Decimal;
      positionQuantity: Decimal;
      riskRewardRatio: Decimal;
      /** The R:R after fees (TP-0). */
      netRiskReward: Decimal | null;
    }
  | {
      kind: 'refused';
      deviationR: Decimal;
      maxDeviationR: Decimal;
      expectedFillPrice: Decimal | null;
      takeProfitReached: boolean;
    };

/**
 * SCR-19: what closing the position now would give (UC-21, T-046), by the
 * current last price moved by the slippage; not stored, not reserved.
 */
export interface CloseEstimate {
  currentPrice: Decimal;
  estimatedExitPrice: Decimal;
  /** The price result, no fees, no funding. */
  priceResult: Decimal;
  entryFee: Decimal;
  /** At the taker rate. */
  estimatedExitFee: Decimal;
  /** Futures: + received / − paid so far; null on Spot. */
  fundingSoFar: Decimal | null;
  fundingProvisional: boolean;
  estimatedNetPnl: Decimal;
  at: ISODateTime;
}

/** `/user/queue/positions`: a position of the Trader changed (it closed). */
export interface PositionUpdate {
  planId: string;
  status: PositionStatus;
  closeReason: PositionCloseReason | null;
  netPnl: Decimal | null;
  provisional: boolean;
}

/** New levels of an OPEN position (D-124); null keeps the current one. */
export interface PositionLevels {
  stopLoss: Decimal | null;
  takeProfit: Decimal | null;
}

/** SCR-18: inputs, snapshot, warnings and status history of one plan. */
export interface TradingPlan {
  id: string;
  pairId: string;
  market: MarketType;
  direction: PlanDirection;
  entryType: PlanEntryType;
  entryPrice: Decimal;
  /**
   * MARKET only: the reference price moved by the configured slippage, the
   * price the quantity is sized on (D-112); null for LIMIT and STOP.
   */
  expectedFillPrice: Decimal | null;
  stopLoss: Decimal;
  takeProfit: Decimal;
  capital: Decimal;
  riskPercent: Decimal;
  leverage: number | null;
  marginMode: 'ISOLATED' | null;
  expiresAt: ISODateTime | null;
  note: string | null;
  /**
   * The entry the deviation is measured from: the entered price (LIMIT,
   * STOP), the price of the last save (MARKET) (BR-69).
   */
  plannedEntryPrice: Decimal | null;
  /** LIMIT and STOP only (BR-68). */
  invalidationPrice: Decimal | null;
  /** The plan's own entry deviation limit in R; null for the system's. */
  maxEntryDeviationR: Decimal | null;
  /** Always set by a backend with plan validity (TP-A); null from one without. */
  analysisTimeframe: PlanTimeframe | null;
  status: PlanStatus;
  invalidationReason: PlanInvalidationReason | null;
  /**
   * The setup score taken at activation, 0–100 (D-112); null before it or
   * when none could be read. Shown as given, never computed here.
   */
  setupScoreAtPlan: Decimal | null;
  /** The preset it was read under, e.g. "DAY_TRADING v1". */
  setupScorePreset: string | null;
  /** True only for DRAFT. */
  editable: boolean;
  snapshot: PlanSnapshot;
  warnings: readonly PlanWarning[];
  blocksActivation: boolean;
  /** Oldest first. */
  statusHistory: readonly { status: PlanStatus; at: ISODateTime }[];
  /** EXECUTED only (T-048a); null before the fill and for a plan filled before. */
  position: PlanPosition | null;
}

/**
 * SCR-17 inputs (SRS 3.5.1, UC-16, UC-17). Editing replaces them whole;
 * the pair never changes. Null leaves a value to the server's default
 * (entry price for MARKET, risk % from the profile, a 7-day expiry for
 * LIMIT and STOP, the analysis timeframe of the trading style). The
 * capital is never sent: every plan is sized on the profile's default
 * capital (D-121).
 */
export interface PlanInputs {
  market: MarketType;
  /** LONG only on Spot (BR-21). */
  direction: PlanDirection;
  entryType: PlanEntryType;
  entryPrice: Decimal | null;
  stopLoss: Decimal;
  takeProfit: Decimal;
  riskPercent: Decimal | null;
  /** Futures only; null on Spot. */
  leverage: number | null;
  expiresAt: ISODateTime | null;
  note: string | null;
  /** LIMIT and STOP only; on the far side of the last price (BR-68). */
  invalidationPrice: Decimal | null;
  /** Above 0 and at most the system's 0.75 R (BR-69). */
  maxEntryDeviationR: Decimal | null;
  /** Null for the trading style's (BR-70). */
  analysisTimeframe: PlanTimeframe | null;
}

/** The live risk panel of SCR-17 (`POST /plans/calculate`); nothing is saved. */
export interface PlanCalculation {
  /** On the tick; for MARKET the current last price. */
  entryPrice: Decimal;
  /**
   * MARKET only: the reference price moved by the configured slippage, the
   * price the quantity is sized on (D-112); null for LIMIT and STOP.
   */
  expectedFillPrice: Decimal | null;
  /** After the profile defaults. */
  capital: Decimal;
  riskPercent: Decimal;
  snapshot: PlanSnapshot;
  warnings: readonly PlanWarning[];
  blocksActivation: boolean;
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
/**
 * Community feed tabs (SRS 3.7.1, D-99): TRENDING is "For You", the most
 * discussed posts of the week; SAVED, MINE and FOLLOWING are the Trader's.
 */
export type FeedTab =
  'TRENDING' | 'LATEST' | 'MOST_LIKED' | 'FOLLOWING' | 'SAVED' | 'MINE';
/** Which way a post leans: its author's stance, a reader's vote (D-99). */
export type PostSentiment = 'BULLISH' | 'BEARISH';
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
/** How the author of a post counts in the community (D-99). */
export interface AuthorStanding {
  influenceScore: number;
  followers: number;
  /** The caller follows them, so the card offers Following. */
  followedByMe: boolean;
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
  authorStanding: AuthorStanding;
  title: string;
  postType: PostType;
  market: MarketType | null;
  /** Announcements are pinned above the feed (BR-61). */
  official: boolean;
  officialCategory: OfficialCategory | null;
  status: PostStatus;
  /** The author's stance, or null (D-99). */
  sentiment: PostSentiment | null;
  /** Coin symbols, alphabetical. */
  coins: readonly string[];
  likeCount: number;
  commentCount: number;
  /** Signed-in members other than the author who opened it (D-99). */
  viewCount: number;
  bullishCount: number;
  bearishCount: number;
  /** The caller's Bullish or Bearish vote, or null. */
  myVote: PostSentiment | null;
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
  /** The author's stance; absent or null for none (D-99). */
  sentiment?: PostSentiment | null;
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
  followers: number;
  following: number;
  followedByMe: boolean;
  blockedByMe: boolean;
  me: boolean;
}
/** A post's Bullish and Bearish votes after the caller voted (D-99). */
export interface PostVotes {
  myVote: PostSentiment | null;
  bullishCount: number;
  bearishCount: number;
}
/** Social Influence or Analytical Depth (D-99). */
export type InfluencerRank = 'INFLUENCE' | 'DEPTH';
/** One row of Top Influencers (D-99). */
export interface Influencer {
  userId: string;
  displayName: string | null;
  avatarUrl: string | null;
  influenceScore: number;
  depthScore: number;
  followers: number;
  /** Their posts of the last 30 days marked Bullish. */
  bullishPosts: number;
  bearishPosts: number;
  followedByMe: boolean;
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
/** How a crawl of a news source ended (NSF-10). */
export type CrawlStatus = 'SUCCESS' | 'PARTIAL' | 'FAILED';
/**
 * An RSS source of SCR-41 (UC-49) as the console shows it: its settings,
 * its last crawl and when it is crawled next (null while switched off, or
 * before its first crawl).
 */
export interface NewsSource {
  id: string;
  sourceName: string;
  feedUrl: string;
  crawlIntervalMinutes: number;
  active: boolean;
  categoryFilter: string | null;
  bodySelector: string | null;
  excludedSelectors: string | null;
  userAgent: string | null;
  lastCrawledAt: ISODateTime | null;
  lastCrawl: {
    startedAt: ISODateTime;
    status: CrawlStatus;
    articlesFound: number | null;
    articlesInserted: number | null;
  } | null;
  nextCrawlAt: ISODateTime | null;
}
/** What an administrator sets on a source; blank optional values are none. */
export interface NewsSourceDraft {
  sourceName: string;
  feedUrl: string;
  crawlIntervalMinutes: number;
  active: boolean;
  categoryFilter: string | null;
  bodySelector: string | null;
  excludedSelectors: string | null;
  userAgent: string | null;
}
export interface NewsCrawlLog {
  id: string;
  startedAt: ISODateTime;
  finishedAt: ISODateTime | null;
  status: CrawlStatus;
  articlesFound: number | null;
  articlesInserted: number | null;
  errorMessage: string | null;
}
export interface NewsCrawlLogPage {
  items: readonly NewsCrawlLog[];
  page: number;
  pageSize: number;
  total: number;
}
/**
 * Where a collected article stands for the console (T-080b, D-124):
 * FAILED once NSF-11 has used its attempts without a summary.
 */
export type NewsArticleStatus = 'PENDING' | 'FAILED' | 'SUMMARIZED' | 'HIDDEN';
/**
 * How many shown articles of the last 24 hours carry each sentiment
 * (D-126): the administrators' view of the feed's tone. Articles not
 * summarized yet are not counted.
 */
export interface NewsSentimentCounts {
  since: ISODateTime;
  bullish: number;
  neutral: number;
  bearish: number;
}
export interface AdminNewsArticle {
  id: string;
  sourceId: string;
  source: string;
  title: string;
  aiTitle: string | null;
  /** An http(s) address. */
  originalUrl: string;
  excerpt: string | null;
  aiSummary: string | null;
  sentiment: 'BULLISH' | 'NEUTRAL' | 'BEARISH' | null;
  publishedAt: ISODateTime;
  collectedAt: ISODateTime;
  status: NewsArticleStatus;
  summaryAttempts: number;
  summaryError: string | null;
  summaryAttemptedAt: ISODateTime | null;
  hiddenAt: ISODateTime | null;
}
export interface AdminNewsArticleQuery {
  status?: NewsArticleStatus;
  sourceId?: string;
  page: number;
  pageSize: number;
}
export interface AdminNewsArticlePage {
  items: readonly AdminNewsArticle[];
  page: number;
  pageSize: number;
  total: number;
}
/** The tone the AI reads in an article (NSF-11). */
export type NewsSentiment = 'BULLISH' | 'NEUTRAL' | 'BEARISH';
/** How far back the news feed reaches (SRS 3.8.1); 7d when none is named. */
export type NewsRange = '24h' | '7d' | '30d';
export interface NewsCoinTag {
  symbol: string;
  /** The first coin the headline names. */
  primary: boolean;
}
/**
 * One item of the news feed (SCR-28, UC-34), the same on every plan
 * (D-122). Once summarized, title and summary are the AI's Vietnamese text
 * (D-123); until then the collected headline and the feed's excerpt.
 * Selecting it opens the article's page in the app (D-125).
 */
export interface NewsArticle {
  id: string;
  title: string;
  /** The headline as the outlet wrote it. */
  originalTitle: string;
  source: string;
  /** An http(s) address, linked at the end of the article's page. */
  originalUrl: string;
  publishedAt: ISODateTime;
  summary: string | null;
  aiSummarized: boolean;
  /** Absent until the article is summarized. */
  sentiment: NewsSentiment | null;
  /** Primary coin first. */
  coins: readonly NewsCoinTag[];
  /** The outlet's cover image, an http(s) address shown from the outlet; null for a placeholder. */
  imageUrl: string | null;
}
/**
 * An article read on its own page (D-125): the item with the article the AI
 * wrote again in its own words, paragraphs split by a blank line; null until
 * then, when the page shows the summary.
 */
export interface NewsArticleDetail extends NewsArticle {
  body: string | null;
}
export interface NewsQuery {
  coin?: string;
  sentiment?: NewsSentiment;
  range?: NewsRange;
  page: number;
  pageSize: number;
}
export interface NewsPage {
  items: readonly NewsArticle[];
  page: number;
  pageSize: number;
  total: number;
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

/** How much a reader should already know before an Academy lesson (T-114). */
export type AcademyLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
export interface AcademyTopic {
  slug: string;
  name: string;
  description: string;
  /** Published lessons in the topic. */
  articles: number;
}
export interface AcademyArticleSummary {
  slug: string;
  title: string;
  summary: string;
  level: AcademyLevel;
  readingMinutes: number;
  topicSlug: string;
  topicName: string;
  /** Place on the beginner path, or null when the lesson is not on it. */
  pathOrder: number | null;
  /** The cover photo, or null for a lesson that has none yet. */
  coverImageUrl: string | null;
}
export interface AcademyArticlePage {
  items: readonly AcademyArticleSummary[];
  page: number;
  pageSize: number;
  total: number;
}
export interface AcademyArticleQuery {
  topic?: string;
  level?: AcademyLevel;
  q?: string;
  page: number;
  pageSize: number;
}
export interface AcademyArticleLink {
  slug: string;
  title: string;
}
export interface AcademyArticle extends AcademyArticleSummary {
  /** Markdown. */
  body: string;
  /** A screen of the app the lesson leads to, such as /trade/spot. */
  appLink: string | null;
  publishedAt: string;
  updatedAt: string;
  previous: AcademyArticleLink | null;
  next: AcademyArticleLink | null;
  related: readonly AcademyArticleSummary[];
  /** Who took the cover photo, e.g. "Jane Doe / Unsplash". */
  coverCredit: string | null;
}
export interface AcademyTerm {
  slug: string;
  term: string;
  definition: string;
  articleSlug: string | null;
  articleTitle: string | null;
}
export interface AcademyCompletedLesson {
  slug: string;
  completedAt: string;
}
/** How far a Trader is in the Academy (T-114). */
export interface AcademyProgress {
  completed: readonly AcademyCompletedLesson[];
  publishedTotal: number;
  pathCompleted: number;
  pathTotal: number;
}
