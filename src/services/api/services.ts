import type { AuthService } from '../auth/contracts';
import type {
  AdminService,
  AiService,
  AlertsService,
  AnalysisService,
  CommunityService,
  JournalService,
  MarketFeed,
  MarketService,
  NewsService,
  ProfileService,
  SubscriptionService,
  TradingPlanService,
  WatchlistService,
} from './contracts';
import type { HttpClient } from './http-client';

export interface Services {
  mode: 'backend-pending' | 'development-fixtures' | 'backend';
  http: HttpClient;
  auth: AuthService;
  profile: ProfileService;
  market: MarketService;
  marketFeed: MarketFeed;
  analysis: AnalysisService;
  tradingPlan: TradingPlanService;
  journal: JournalService;
  watchlist: WatchlistService;
  alerts: AlertsService;
  community: CommunityService;
  news: NewsService;
  ai: AiService;
  subscription: SubscriptionService;
  admin: AdminService;
}
