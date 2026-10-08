import type {
  AdminLog,
  AiConversation,
  CoinAnalysis,
  CommunityPost,
  JournalEntry,
  Candle,
  CandleTimeframe,
  MarketOverview,
  MarketPair,
  MarketTicker,
  MarketType,
  NewsArticle,
  PriceAlert,
  ProfileUpdate,
  RiskProfile,
  RiskProfileParams,
  RiskQuestion,
  RiskSuggestion,
  UserProfile,
  SubscriptionPackage,
  TradingPlan,
} from '../../types/domain';

/** UI-facing contracts only. Pagination and transport DTOs need backend agreement. */
export interface ListRequest {
  cursor?: string;
  limit?: number;
  signal?: AbortSignal;
}
export interface ListResponse<T> {
  items: readonly T[];
  nextCursor: string | null;
}
export interface ReadService<T> {
  list(request?: ListRequest): Promise<ListResponse<T>>;
}
export interface CandlesRequest {
  market: MarketType;
  symbol: string;
  timeframe: CandleTimeframe;
  limit: number;
  signal?: AbortSignal;
}
/** Public market data (`/market/**`, SRS 3.3.1); no token needed. */
export interface MarketService {
  /** Every enabled pair of a market, in admin display order. */
  listPairs(
    market: MarketType,
    signal?: AbortSignal,
  ): Promise<readonly MarketPair[]>;
  /** Closed candles, oldest first. */
  getCandles(request: CandlesRequest): Promise<readonly Candle[]>;
  /**
   * Stored ticker snapshot (up to about a minute old) for the Delayed
   * fallback (CR-09); null until the backend has one.
   */
  getTicker(
    market: MarketType,
    symbol: string,
    signal?: AbortSignal,
  ): Promise<MarketTicker | null>;
}

export type FeedStatus = 'connecting' | 'open' | 'closed' | 'unavailable';
/** Realtime market topics over STOMP (TD 9); public, no token. */
export interface MarketFeed {
  status(): FeedStatus;
  onStatus(listener: () => void): () => void;
  subscribeOverview(
    market: MarketType,
    listener: (overview: MarketOverview) => void,
  ): () => void;
}
export interface CoinAnalysisRequest {
  symbol: string;
  marketType: MarketType;
  timeframe: string;
  signal?: AbortSignal;
}
export interface CoinAnalysisService {
  get(request: CoinAnalysisRequest): Promise<CoinAnalysis>;
}
export type TradingPlanService = ReadService<TradingPlan>;
export type JournalService = ReadService<JournalEntry>;
export type AlertsService = ReadService<PriceAlert>;
export type CommunityService = ReadService<CommunityPost>;
export type NewsService = ReadService<NewsArticle>;
export type AiService = ReadService<AiConversation>;
export type SubscriptionService = ReadService<SubscriptionPackage>;
export type AdminService = ReadService<AdminLog>;

/** Account settings of the signed-in Trader (`/me/*`; the password is in `AuthService`). */
export interface ProfileService {
  get(signal?: AbortSignal): Promise<UserProfile>;
  update(update: ProfileUpdate): Promise<void>;
  updateNotifications(preferences: {
    email: boolean;
    push: boolean;
  }): Promise<void>;
  getRiskProfile(signal?: AbortSignal): Promise<RiskProfileParams>;
  /** AGGRESSIVE requires the MSG48 confirmation first. */
  chooseRiskProfile(
    profile: RiskProfile,
    confirmAggressive: boolean,
  ): Promise<void>;
  getQuestionnaire(signal?: AbortSignal): Promise<readonly RiskQuestion[]>;
  suggestRiskProfile(
    answers: Readonly<Record<string, string>>,
  ): Promise<RiskSuggestion>;
}
