import type { Environment } from '../config/env';
import { createHttpClient } from '../../services/api/http-client';
import type { Services } from '../../services/api/services';
import { unconfiguredAuth } from '../../services/auth/unconfigured-auth';
import {
  createHttpAuthService,
  createRefresher,
} from '../../services/auth/http-auth';
import { TokenSession } from '../../services/auth/token-session';
import {
  createHttpProfileService,
  createPendingProfileService,
} from '../../services/api/profile';
import {
  createHttpMarketService,
  createPendingMarketService,
  unavailableMarketFeed,
} from '../../services/api/market';
import { createStompMarketFeed } from '../../services/websocket/stomp-market-feed';
import {
  createHttpAnalysisService,
  createPendingAnalysisService,
} from '../../services/api/analysis';
import {
  createHttpTradingPlanService,
  createPendingTradingPlanService,
} from '../../services/api/trading-plan';
import { createJournalService } from '../../services/api/journal';
import { createAlertsService } from '../../services/api/alerts';
import { createCommunityService } from '../../services/api/community';
import { createNewsService } from '../../services/api/news';
import { createAiService } from '../../services/api/ai';
import { createSubscriptionService } from '../../services/api/subscription';
import { createAdminService } from '../../services/api/admin';

export async function createServices(env: Environment): Promise<Services> {
  // The session renews through the same client it authorizes (anonymous call).
  const tokens = new TokenSession(createRefresher(() => http));
  const http = createHttpClient({ baseUrl: env.apiBaseUrl, session: tokens });
  const connected = env.apiBaseUrl !== '';
  const services: Services = {
    mode: connected ? 'backend' : 'backend-pending',
    http,
    auth: connected ? createHttpAuthService(http, tokens) : unconfiguredAuth,
    profile: connected
      ? createHttpProfileService(http)
      : createPendingProfileService(),
    market: connected
      ? createHttpMarketService(http)
      : createPendingMarketService(),
    marketFeed: env.wsUrl
      ? createStompMarketFeed(env.wsUrl)
      : unavailableMarketFeed,
    analysis: connected
      ? createHttpAnalysisService(http)
      : createPendingAnalysisService(),
    tradingPlan: connected
      ? createHttpTradingPlanService(http)
      : createPendingTradingPlanService(),
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
