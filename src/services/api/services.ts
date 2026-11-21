import type { AuthService } from '../auth/contracts';
import type {
  AcademyService,
  AdminPairService,
  AdminService,
  AdminSettingService,
  AdminAuditService,
  AdminDashboardService,
  AdminUserService,
  AiAdminService,
  AiService,
  AlertsService,
  AnalysisService,
  AnnouncementService,
  CommunityService,
  NotificationService,
  ModerationService,
  JournalService,
  PerformanceService,
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
import type { AdminOrderService } from './admin-orders';
import type { FuturesTradingService } from './futures';
import type { MarketStatusService } from './market-status';
import type { HttpClient } from './http-client';

export interface Services {
  mode: 'backend-pending' | 'development-fixtures' | 'backend';
  http: HttpClient;
  auth: AuthService;
  profile: ProfileService;
  market: MarketService;
  marketFeed: MarketFeed;
  /** The markets' data health, reference prices and maintenance (D-159). */
  marketStatus: MarketStatusService;
  tradingMarket: TradingMarketService;
  analysis: AnalysisService;
  tradingPlan: TradingPlanService;
  journal: JournalService;
  performance: PerformanceService;
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
  aiAdmin: AiAdminService;
  subscription: SubscriptionService;
  admin: AdminService;
  adminPairs: AdminPairService;
  adminSettings: AdminSettingService;
  adminUsers: AdminUserService;
  adminDashboard: AdminDashboardService;
  adminAudit: AdminAuditService;
  /** SCR-40 (UC-48): the subscription orders. */
  adminOrders: AdminOrderService;
}
