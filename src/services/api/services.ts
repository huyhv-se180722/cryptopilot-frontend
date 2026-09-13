import type { AuthService } from '../auth/contracts';
import type {
  AdminService,
  AiService,
  AlertsService,
  CoinAnalysisService,
  CommunityService,
  JournalService,
  MarketService,
  NewsService,
  SubscriptionService,
  TradingPlanService,
} from './contracts';
import type { HttpClient } from './http-client';

export interface Services {
  mode: 'backend-pending' | 'development-fixtures' | 'backend';
  http: HttpClient;
  auth: AuthService;
  market: MarketService;
  coinAnalysis: CoinAnalysisService;
  tradingPlan: TradingPlanService;
  journal: JournalService;
  alerts: AlertsService;
  community: CommunityService;
  news: NewsService;
  ai: AiService;
  subscription: SubscriptionService;
  admin: AdminService;
}
