import type { Services } from '../services/api/services';
import { createDevelopmentAdminPairs } from './dev-admin-pairs';
import { createDevelopmentAdminSettings } from './dev-admin-settings';
import { createDevelopmentAuth } from './dev-auth';
import { createDevelopmentCommunity } from './dev-community';
import { createDevelopmentMarket } from './dev-market';
import { createDevelopmentNotifications } from './dev-notifications';
import { createDevelopmentPaperTrading } from './dev-paper-trading';
import { createDevelopmentProfile } from './dev-profile';
import { createDevelopmentTradingPlan } from './dev-trading-plan';
import { createDevelopmentWatchlist } from './dev-watchlist';

/** DEVELOPMENT ONLY. All unimplemented operations still fail explicitly. */
export function createDevelopmentServices(base: Services): Services {
  const auth = createDevelopmentAuth();
  const market = createDevelopmentMarket();
  return {
    ...base,
    mode: 'development-fixtures',
    auth,
    profile: createDevelopmentProfile(),
    ...market,
    tradingPlan: createDevelopmentTradingPlan(() => auth.restoreSession()),
    ...createDevelopmentWatchlist(() => auth.restoreSession()),
    ...createDevelopmentPaperTrading(
      () => auth.restoreSession(),
      market.market,
    ),
    ...createDevelopmentCommunity(() => auth.restoreSession()),
    ...createDevelopmentNotifications(() => auth.restoreSession()),
    adminPairs: createDevelopmentAdminPairs(),
    adminSettings: createDevelopmentAdminSettings(),
  };
}
