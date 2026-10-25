import type { TradingPlanService } from '../services/api/contracts';
import { ServiceError } from '../services/api/errors';
import type {
  PlanCalculation,
  PlanInputs,
  PlanStatus,
  PlanTab,
  Session,
  TradingPlan,
  TradingPlanSummary,
} from '../types/domain';
import { devPairs } from './fixtures/market';
import { devPlanSeeds } from './fixtures/trading-plan';

/**
 * DEVELOPMENT ONLY. In-memory `/plans/**` with the backend's answers for
 * SCR-16, SCR-17 (create and edit) and SCR-18: request rules and BR-22 as
 * field errors on calculate / create / update (the result itself is
 * scripted, from a plan on the pair or else the first one), tabs,
 * market and period filters, 404 MSG41,
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
  fieldErrors: Readonly<Record<string, string>> = {},
): never {
  throw new ServiceError('Development plan refusal.', 'HTTP_ERROR', status, {
    status,
    code,
    messageCode,
    messageArgs,
    fieldErrors,
  });
}

/**
 * The request rules of `CreateTradingPlanRequest` and the price order of
 * BR-22 as field errors (MSG01 / MSG15 / MSG16), checked in that order like
 * the backend; Futures is refused on `leverage` (no brackets, D-70). The
 * calculation itself is not re-implemented.
 */
function checkInputs(inputs: PlanInputs) {
  const errors: Record<string, string> = {};
  const positive = (value: string | null) =>
    value !== null && /^\d+(\.\d+)?$/.test(value) && Number(value) > 0;
  if (inputs.entryType !== 'MARKET' && inputs.entryPrice === null)
    errors.entryPrice = 'MSG01';
  if (inputs.entryType === 'MARKET' && inputs.invalidationPrice !== null)
    errors.invalidationPrice = 'MSG01';
  for (const key of [
    'entryPrice',
    'stopLoss',
    'takeProfit',
    'invalidationPrice',
  ] as const)
    if (inputs[key] !== null && !positive(inputs[key])) errors[key] = 'MSG15';
  const risk = inputs.riskPercent === null ? null : Number(inputs.riskPercent);
  if (risk !== null && !(risk >= 0.1 && risk <= 10))
    errors.riskPercent = 'MSG15';
  if (inputs.market === 'spot' && inputs.direction === 'SHORT')
    errors.direction = 'MSG01';
  if ((inputs.note?.length ?? 0) > 1000) errors.note = 'MSG15';
  if (Object.keys(errors).length)
    refuse(400, 'VALIDATION_FAILED', 'MSG01', [], errors);
  if (inputs.market === 'futures')
    refuse(400, 'VALIDATION_FAILED', 'MSG01', [], { leverage: 'MSG15' });
  if (inputs.entryPrice === null) return;
  const entry = Number(inputs.entryPrice);
  const long = inputs.direction === 'LONG';
  const stop = Number(inputs.stopLoss);
  const take = Number(inputs.takeProfit);
  if (long ? stop >= entry : stop <= entry)
    refuse(400, 'VALIDATION_FAILED', 'MSG01', [], { stopLoss: 'MSG16' });
  if (long ? take <= entry : take >= entry)
    refuse(400, 'VALIDATION_FAILED', 'MSG01', [], { takeProfit: 'MSG16' });
}

const TABS: Record<PlanTab, readonly PlanStatus[]> = {
  DRAFT: ['DRAFT'],
  ACTIVE: ['ACTIVE'],
  EXECUTED: ['EXECUTED'],
  CANCELLED_EXPIRED: ['CANCELLED', 'EXPIRED', 'INVALIDATED'],
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
    expectedFillPrice: plan.expectedFillPrice,
    stopLoss: plan.stopLoss,
    takeProfit: plan.takeProfit,
    leverage: plan.leverage,
    riskAmount: plan.snapshot.riskAmount,
    riskRewardRatio: plan.snapshot.riskRewardRatio,
    status: plan.status,
    createdAt: created,
    activatedAt: activated?.at ?? null,
    expiresAt: plan.expiresAt,
    invalidatedAt:
      plan.status === 'INVALIDATED'
        ? (plan.statusHistory.at(-1)?.at ?? null)
        : null,
    invalidationReason: plan.invalidationReason,
    positionStatus: plan.position?.status ?? null,
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

  /** A pair enabled on the market of the inputs; MSG41 otherwise. */
  const enabled = (pairId: string, inputs: PlanInputs) => {
    if (!devPairs(inputs.market).some((pair) => pair.pairId === pairId))
      refuse(404, 'RESOURCE_NOT_FOUND', 'MSG41');
  };
  /**
   * Scripted: the stored calculation of a plan on that pair, or of the
   * first plan for a pair that has none yet.
   */
  const calculation = (pairId: string, inputs: PlanInputs): PlanCalculation => {
    const all = [...plans.values()];
    const base =
      all.find((plan) => plan.pairId === pairId && plan.status === 'DRAFT') ??
      all.find((plan) => plan.pairId === pairId) ??
      all[0];
    if (!base) return refuse(404, 'RESOURCE_NOT_FOUND', 'MSG41');
    return {
      entryPrice: inputs.entryPrice ?? base.entryPrice,
      expectedFillPrice:
        inputs.entryType === 'MARKET'
          ? (base.expectedFillPrice ?? base.entryPrice)
          : null,
      capital: base.capital,
      riskPercent: inputs.riskPercent ?? base.riskPercent,
      snapshot: base.snapshot,
      warnings: base.warnings,
      blocksActivation: base.blocksActivation,
    };
  };
  /** What a save stores from the inputs and the scripted calculation. */
  const saved = (inputs: PlanInputs, result: PlanCalculation) => ({
    ...inputs,
    entryPrice: result.entryPrice,
    expectedFillPrice: result.expectedFillPrice,
    plannedEntryPrice: result.entryPrice,
    capital: result.capital,
    riskPercent: result.riskPercent,
    analysisTimeframe: inputs.analysisTimeframe ?? '1h',
    expiresAt:
      inputs.expiresAt ??
      (inputs.entryType === 'MARKET'
        ? null
        : new Date(now() + 7 * 86_400_000).toISOString()),
    snapshot: result.snapshot,
    warnings: result.warnings,
    blocksActivation: result.blocksActivation,
  });
  const activeLimit = async () => {
    const entitlements = (await session())?.entitlements;
    const max =
      entitlements && entitlements !== 'unknown'
        ? entitlements.limits.ACTIVE_PLAN_MAX
        : undefined;
    // An open position keeps its slot (BR-62, T-048a).
    const active = [...plans.values()].filter(
      (other) => other.status === 'ACTIVE' || other.position?.status === 'OPEN',
    ).length;
    if (typeof max === 'number' && active >= max)
      refuse(409, 'PLAN_LIMIT_REACHED', 'MSG27', [
        String(max),
        'active plans and open positions',
        entitlements && entitlements !== 'unknown' ? entitlements.tier : '',
      ]);
  };

  let created = 0;
  return {
    async calculate(pairId, inputs, signal) {
      await pause(signal);
      checkInputs(inputs);
      enabled(pairId, inputs);
      return calculation(pairId, inputs);
    },
    async create(pairId, inputs, activate) {
      await pause();
      checkInputs(inputs);
      enabled(pairId, inputs);
      const result = calculation(pairId, inputs);
      // An activation refused saves nothing, like the backend.
      if (activate && result.blocksActivation)
        refuse(409, 'TRADING_BLOCKING_WARNING', 'MSG18');
      if (activate) await activeLimit();
      const at = new Date(now()).toISOString();
      const plan: TradingPlan = {
        id: `0199a2c4-0000-7000-8000-${String(900 + created++).padStart(12, '0')}`,
        pairId,
        ...saved(inputs, result),
        marginMode: inputs.market === 'futures' ? 'ISOLATED' : null,
        status: 'DRAFT',
        invalidationReason: null,
        setupScoreAtPlan: null,
        setupScorePreset: null,
        editable: true,
        statusHistory: [{ status: 'DRAFT', at }],
        position: null,
      };
      plans.set(plan.id, plan);
      return activate ? move(plan, 'ACTIVE') : plan;
    },
    async update(id, inputs, activate) {
      await pause();
      const plan = find(id);
      if (plan.status !== 'DRAFT')
        refuse(409, 'TRADING_PLAN_STATUS_TRANSITION_INVALID', 'MSG43');
      checkInputs(inputs);
      const result = calculation(plan.pairId, inputs);
      // An activation refused saves nothing, like the backend.
      if (activate && result.blocksActivation)
        refuse(409, 'TRADING_BLOCKING_WARNING', 'MSG18');
      if (activate) await activeLimit();
      const next: TradingPlan = { ...plan, ...saved(inputs, result) };
      plans.set(id, next);
      return activate ? move(next, 'ACTIVE') : next;
    },
    async list({ tab, pairId, market, from, page, pageSize }, signal) {
      await pause(signal);
      const rows = [...plans.values()]
        .filter((plan) => TABS[tab].includes(plan.status))
        .filter((plan) => !pairId || plan.pairId === pairId)
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
      await activeLimit();
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
