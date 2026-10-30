import type { AuthService } from '../auth/contracts';
import type {
  AcademyService,
  AdminPairService,
  AdminService,
  AdminSettingService,
  AdminDashboardService,
  AdminUserService,
  AiService,
  AlertsService,
  AnalysisService,
  AnnouncementService,
  CommunityService,
  NotificationService,
  ModerationService,
  JournalService,
  MarketFeed,
  MarketService,
  NewsAdminService,
  NewsService,
  PaperTradingService,
  ProfileService,
  SubscriptionService,
  TradingMarketService,
  TradingPlanService,
  WatchlistService,
} from './contracts';
import type { FuturesTradingService } from './futures';
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
  futuresTrading: FuturesTradingService;
  community: CommunityService;
  news: NewsService;
  academy: AcademyService;
  newsAdmin: NewsAdminService;
  notifications: NotificationService;
  moderation: ModerationService;
  announcements: AnnouncementService;
  ai: AiService;
  subscription: SubscriptionService;
  admin: AdminService;
  adminPairs: AdminPairService;
  adminSettings: AdminSettingService;
  adminUsers: AdminUserService;
  adminDashboard: AdminDashboardService;
}
