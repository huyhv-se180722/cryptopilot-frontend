import type {
  AdminLog,
  AiConversation,
  CoinAnalysis,
  CommunityPost,
  JournalEntry,
  MarketQuote,
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
export interface MarketRequest extends ListRequest {
  marketType?: MarketType;
}
export interface MarketService {
  list(request?: MarketRequest): Promise<ListResponse<MarketQuote>>;
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

export interface PasswordChange {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}
/** Account settings of the signed-in user (`/me/*`; password for Trader and Admin). */
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
  changePassword(change: PasswordChange): Promise<void>;
}
