import type { AuthService } from '../auth/contracts';
import type {
  AdminService,
  AiService,
  AlertsService,
  AnalysisService,
  CommunityService,
  NotificationService,
  JournalService,
  MarketFeed,
  MarketService,
  NewsService,
  PaperTradingService,
  ProfileService,
  SubscriptionService,
  TradingMarketService,
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
  tradingMarket: TradingMarketService;
  analysis: AnalysisService;
  tradingPlan: TradingPlanService;
  journal: JournalService;
  watchlist: WatchlistService;
  alerts: AlertsService;
  paperTrading: PaperTradingService;
  community: CommunityService;
  news: NewsService;
  notifications: NotificationService;
  ai: AiService;
  subscription: SubscriptionService;
  admin: AdminService;
}
