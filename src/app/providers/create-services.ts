import type { Environment } from '../config/env';
import { createHttpClient } from '../../services/api/http-client';
import type { Services } from '../../services/api/services';
import { unconfiguredAuth } from '../../services/auth/unconfigured-auth';
import {
  createHttpAuthService,
  createRefresher,
} from '../../services/auth/http-auth';
import { browserSessionStore } from '../../services/auth/session-store';
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
  createHttpTradingMarketService,
  createPendingTradingMarketService,
} from '../../services/api/trading-market';
import { paperTradingEnabled } from '../config/features';
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
import {
  createHttpPaperTradingService,
  createPendingPaperTradingService,
} from '../../services/api/paper-trading';
import { createCommunityService } from '../../services/api/community';
import { createNewsService } from '../../services/api/news';
import { createAiService } from '../../services/api/ai';
import { createSubscriptionService } from '../../services/api/subscription';
import { createAdminService } from '../../services/api/admin';

export async function createServices(env: Environment): Promise<Services> {
  // The session renews through the same client it authorizes (anonymous call).
  // The refresh token survives a reload in the tab's sessionStorage (D-109).
  const store = browserSessionStore();
  const tokens = new TokenSession(
    createRefresher(() => http),
    undefined,
    store,
  );
  const http = createHttpClient({ baseUrl: env.apiBaseUrl, session: tokens });
  const connected = env.apiBaseUrl !== '';
  const stomp = env.wsUrl ? createStompMarketFeed(env.wsUrl) : null;
  // Demo trading talks to the backend only while its flag is on (D-101,
  // D-104): the flag says the backend has the paper module.
  const paper = paperTradingEnabled && connected;
  const services: Services = {
    mode: connected ? 'backend' : 'backend-pending',
    http,
    auth: connected
      ? createHttpAuthService(http, tokens, store)
      : unconfiguredAuth,
    profile: connected
      ? createHttpProfileService(http)
      : createPendingProfileService(),
    market: connected
      ? createHttpMarketService(http)
      : createPendingMarketService(),
    marketFeed: stomp ?? unavailableMarketFeed,
    tradingMarket: paper
      ? createHttpTradingMarketService(http, stomp)
      : createPendingTradingMarketService(),
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
    paperTrading: paper
      ? createHttpPaperTradingService(http)
      : createPendingPaperTradingService(),
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
