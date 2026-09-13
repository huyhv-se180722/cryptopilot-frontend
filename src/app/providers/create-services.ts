import type { Environment } from '../config/env';
import { createHttpClient } from '../../services/api/http-client';
import type { Services } from '../../services/api/services';
import { unconfiguredAuth } from '../../services/auth/unconfigured-auth';
import { createMarketService } from '../../services/api/market';
import { createCoinAnalysisService } from '../../services/api/coin-analysis';
import { createTradingPlanService } from '../../services/api/trading-plan';
import { createJournalService } from '../../services/api/journal';
import { createAlertsService } from '../../services/api/alerts';
import { createCommunityService } from '../../services/api/community';
import { createNewsService } from '../../services/api/news';
import { createAiService } from '../../services/api/ai';
import { createSubscriptionService } from '../../services/api/subscription';
import { createAdminService } from '../../services/api/admin';

export async function createServices(env: Environment): Promise<Services> {
  const http = createHttpClient({ baseUrl: env.apiBaseUrl });
  const services: Services = {
    mode: 'backend-pending',
    http,
    auth: unconfiguredAuth,
    market: createMarketService(),
    coinAnalysis: createCoinAnalysisService(),
    tradingPlan: createTradingPlanService(),
    journal: createJournalService(),
    alerts: createAlertsService(),
    community: createCommunityService(),
    news: createNewsService(),
    ai: createAiService(),
    subscription: createSubscriptionService(),
    admin: createAdminService(),
  };
  // Compile-time DEV guard removes the import and all fixtures from production.
  if (import.meta.env.DEV && env.useDevFixtures) {
    const { createDevelopmentServices } =
      await import('../../dev/create-development-services');
    return createDevelopmentServices(services);
  }
  return services;
}
