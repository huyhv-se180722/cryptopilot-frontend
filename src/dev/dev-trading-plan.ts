import type { TradingPlanService } from '../services/api/contracts';
import { ServiceError } from '../services/api/errors';
import type {
  PlanStatus,
  PlanTab,
  Session,
  TradingPlan,
  TradingPlanSummary,
} from '../types/domain';
import { devPlanSeeds } from './fixtures/trading-plan';

/**
 * DEVELOPMENT ONLY. In-memory `/plans/**` with the backend's answers for
 * SCR-16 and SCR-18: tabs, market and period filters, 404 MSG41,
 * activation refused by a BLOCKING warning (MSG18), by the plan's
 * `ACTIVE_PLAN_MAX` (MSG27) or by the status (MSG43), and cancellation.
 * Snapshots and warnings are scripted, not recalculated. A reload
 * restores the fixture.
 */
function refuse(
  status: number,
  code: string,
  messageCode: string,
  messageArgs: readonly string[] = [],
): never {
  throw new ServiceError('Development plan refusal.', 'HTTP_ERROR', status, {
    status,
    code,
    messageCode,
    messageArgs,
    fieldErrors: {},
  });
}

const TABS: Record<PlanTab, readonly PlanStatus[]> = {
  DRAFT: ['DRAFT'],
  ACTIVE: ['ACTIVE'],
  EXECUTED: ['EXECUTED'],
  CANCELLED_EXPIRED: ['CANCELLED', 'EXPIRED'],
};

function summaryOf(plan: TradingPlan): TradingPlanSummary {
  const created = plan.statusHistory[0]?.at ?? new Date(0).toISOString();
  const activated = plan.statusHistory.find(
    (change) => change.status === 'ACTIVE',
  );
  return {
    id: plan.id,
    pairId: plan.pairId,
    market: plan.market,
    direction: plan.direction,
    entryType: plan.entryType,
    entryPrice: plan.entryPrice,
    stopLoss: plan.stopLoss,
    takeProfit: plan.takeProfit,
    leverage: plan.leverage,
    riskAmount: plan.snapshot.riskAmount,
    riskRewardRatio: plan.snapshot.riskRewardRatio,
    status: plan.status,
    createdAt: created,
    activatedAt: activated?.at ?? null,
    expiresAt: plan.expiresAt,
  };
}

const pause = (signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, 150);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(signal.reason);
    });
  });

export function createDevelopmentTradingPlan(
  session: () => Promise<Session | null>,
  now: () => number = Date.now,
): TradingPlanService {
  const plans = new Map(
    devPlanSeeds(now()).map((plan) => [plan.id, plan] as const),
  );
  const find = (id: string) =>
    plans.get(id) ?? refuse(404, 'RESOURCE_NOT_FOUND', 'MSG41');
  const move = (plan: TradingPlan, status: PlanStatus): TradingPlan => {
    const next: TradingPlan = {
      ...plan,
      status,
      editable: false,
      statusHistory: [
        ...plan.statusHistory,
        { status, at: new Date(now()).toISOString() },
      ],
    };
    plans.set(plan.id, next);
    return next;
  };

  return {
    async list({ tab, market, from, page, pageSize }, signal) {
      await pause(signal);
      const rows = [...plans.values()]
        .filter((plan) => TABS[tab].includes(plan.status))
        .filter((plan) => !market || plan.market === market)
        .map(summaryOf)
        .filter((row) => !from || Date.parse(row.createdAt) >= Date.parse(from))
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
      return {
        items: rows.slice((page - 1) * pageSize, page * pageSize),
        page,
        pageSize,
        total: rows.length,
      };
    },
    async get(id, signal) {
      await pause(signal);
      return find(id);
    },
    async activate(id) {
      await pause();
      const plan = find(id);
      if (plan.status !== 'DRAFT')
        refuse(409, 'TRADING_PLAN_STATUS_TRANSITION_INVALID', 'MSG43');
      if (plan.blocksActivation)
        refuse(409, 'TRADING_BLOCKING_WARNING', 'MSG18');
      const entitlements = (await session())?.entitlements;
      const max =
        entitlements && entitlements !== 'unknown'
          ? entitlements.limits.ACTIVE_PLAN_MAX
          : undefined;
      const active = [...plans.values()].filter(
        (other) => other.status === 'ACTIVE',
      ).length;
      if (typeof max === 'number' && active >= max)
        refuse(409, 'PLAN_LIMIT_REACHED', 'MSG27', [
          String(max),
          'active plans and open positions',
          entitlements && entitlements !== 'unknown' ? entitlements.tier : '',
        ]);
      return move(plan, 'ACTIVE');
    },
    async cancel(id) {
      await pause();
      const plan = find(id);
      if (plan.status !== 'DRAFT' && plan.status !== 'ACTIVE')
        refuse(409, 'TRADING_PLAN_STATUS_TRANSITION_INVALID', 'MSG43');
      return move(plan, 'CANCELLED');
    },
  };
}
