import type { Services } from '../services/api/services';
import { createDevelopmentAuth } from './dev-auth';
import { createDevelopmentMarket } from './dev-market';
import { createDevelopmentProfile } from './dev-profile';
import { createDevelopmentTradingPlan } from './dev-trading-plan';
import { createDevelopmentWatchlist } from './dev-watchlist';

/** DEVELOPMENT ONLY. All unimplemented operations still fail explicitly. */
export function createDevelopmentServices(base: Services): Services {
  const auth = createDevelopmentAuth();
  return {
    ...base,
    mode: 'development-fixtures',
    auth,
    profile: createDevelopmentProfile(),
    ...createDevelopmentMarket(),
    tradingPlan: createDevelopmentTradingPlan(() => auth.restoreSession()),
    ...createDevelopmentWatchlist(() => auth.restoreSession()),
  };
}
