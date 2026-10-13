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
import { createPendingTradingMarketService } from '../../services/api/trading-market';
import {
  createHttpAnalysisService,
  createPendingAnalysisService,
} from '../../services/api/analysis';
import {
  createHttpTradingPlanService,
  createPendingTradingPlanService,
} from '../../services/api/trading-plan';
import { createJournalService } from '../../services/api/journal';
import {
  createHttpAlertsService,
  createPendingAlertsService,
} from '../../services/api/alerts';
import {
  createHttpWatchlistService,
  createPendingWatchlistService,
} from '../../services/api/watchlist';
import { createPendingPaperTradingService } from '../../services/api/paper-trading';
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
    tradingMarket: createPendingTradingMarketService(),
    analysis: connected
      ? createHttpAnalysisService(http)
      : createPendingAnalysisService(),
    tradingPlan: connected
      ? createHttpTradingPlanService(http)
      : createPendingTradingPlanService(),
    journal: createJournalService(),
    watchlist: connected
      ? createHttpWatchlistService(http)
      : createPendingWatchlistService(),
    alerts: connected
      ? createHttpAlertsService(http)
      : createPendingAlertsService(),
    paperTrading: createPendingPaperTradingService(),
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
