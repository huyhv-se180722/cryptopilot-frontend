import type { Services } from '../services/api/services';
import { createDevelopmentAdminAudit } from './dev-admin-audit';
import { createDevelopmentAdminPairs } from './dev-admin-pairs';
import { createDevelopmentAdminSettings } from './dev-admin-settings';
import { createDevelopmentAdminDashboard } from './dev-admin-dashboard';
import { createDevelopmentAdminUsers } from './dev-admin-users';
import { createDevelopmentAuth } from './dev-auth';
import { createDevelopmentChartDrawings } from './dev-chart-drawings';
import { createDevelopmentCommunity } from './dev-community';
import { createDevelopmentJournal } from './dev-journal';
import { createDevelopmentMarket } from './dev-market';
import { createDevelopmentNotifications } from './dev-notifications';
import { createDevelopmentPaperTrading } from './dev-paper-trading';
import { createDevelopmentProfile } from './dev-profile';
import { createDevelopmentSubscription } from './dev-subscription';
import { createDevelopmentTradingPlan } from './dev-trading-plan';
import { createDevelopmentWatchlist } from './dev-watchlist';

/** DEVELOPMENT ONLY. All unimplemented operations still fail explicitly. */
export function createDevelopmentServices(base: Services): Services {
  const auth = createDevelopmentAuth();
  const market = createDevelopmentMarket();
  const journal = createDevelopmentJournal(() => auth.restoreSession());
  return {
    ...base,
    mode: 'development-fixtures',
    auth,
    profile: createDevelopmentProfile(),
    subscription: createDevelopmentSubscription(),
    ...market,
    tradingPlan: createDevelopmentTradingPlan(
      () => auth.restoreSession(),
      Date.now,
      journal.recordPlanClose,
    ),
    journal: journal.journal,
    performance: journal.performance,
    ...createDevelopmentWatchlist(() => auth.restoreSession()),
    ...createDevelopmentChartDrawings(),
    ...createDevelopmentPaperTrading(
      () => auth.restoreSession(),
      market.market,
    ),
    ...createDevelopmentCommunity(() => auth.restoreSession()),
    ...createDevelopmentNotifications(() => auth.restoreSession()),
    adminPairs: createDevelopmentAdminPairs(),
    adminSettings: createDevelopmentAdminSettings(),
    adminUsers: createDevelopmentAdminUsers(() => auth.restoreSession()),
    adminDashboard: createDevelopmentAdminDashboard(),
    adminAudit: createDevelopmentAdminAudit(),
  };
}
