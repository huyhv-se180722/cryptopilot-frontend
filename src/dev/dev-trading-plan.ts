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
import { compareDecimal } from '../utils/decimal-format';
import { devPairs } from './fixtures/market';
import { devPlanSeeds } from './fixtures/trading-plan';

/**
 * DEVELOPMENT ONLY. In-memory `/plans/**` with the backend's answers for
 * SCR-16, SCR-17 (create and edit) and SCR-18: request rules and BR-22 as
 * field errors on calculate / create / update (the result itself is
 * scripted, from a plan on the pair or else the first one), the plan
 * validity rules of TP-A (STOP entry, invalidation price, deviation limit,
 * analysis timeframe, the setup score taken at activation), tabs,
 * market and period filters, 404 MSG41,
 * activation refused by a BLOCKING warning (MSG18), by the plan's
 * `ACTIVE_PLAN_MAX` (MSG27) or by the status (MSG43), and cancellation.
 * Futures needs `FUTURES_ANALYSIS` (MSG29) and has one scripted leverage
 * bracket up to 20x for every pair (BR-26).
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

/** Scripted: the largest leverage of every dev pair's single bracket. */
const DEV_MAX_LEVERAGE = 20;

/**
 * The request rules of `CreateTradingPlanRequest` and the price order of
 * BR-22 as field errors (MSG01 / MSG15 / MSG16), checked in that order like
 * the backend; a Futures leverage above the scripted bracket is MSG15 on
 * `leverage`. The calculation itself is not re-implemented.
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
  const deviation =
    inputs.maxEntryDeviationR === null
      ? null
      : Number(inputs.maxEntryDeviationR);
  if (deviation !== null && !(deviation > 0 && deviation <= 0.75))
    errors.maxEntryDeviationR = 'MSG15';
  if (Object.keys(errors).length)
    refuse(400, 'VALIDATION_FAILED', 'MSG01', [], errors);
  if (inputs.market === 'futures' && (inputs.leverage ?? 1) > DEV_MAX_LEVERAGE)
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
  // BR-68 wants the invalidation on the far side of the last price from the
  // entry. Without a last price here, the last price is taken to lie between
  // the two: above a LONG limit, below a LONG stop (the reverse for SHORT).
  if (inputs.invalidationPrice === null) return;
  const invalidation = Number(inputs.invalidationPrice);
  const above = long === (inputs.entryType === 'LIMIT');
  if (above ? invalidation <= entry : invalidation >= entry)
    refuse(400, 'VALIDATION_FAILED', 'MSG01', [], {
      invalidationPrice: 'MSG16',
    });
}

/** The dev profile's trading style is SWING: 4h, and the SWING preset. */
const STYLE_TIMEFRAME = '4h';
const STYLE_PRESET = 'SWING v1';
/** Scripted setup score taken at activation, as the analysis showed it. */
const ACTIVATION_SCORE = '62.00';
const expiryOf = (inputs: PlanInputs, now: number) =>
  inputs.expiresAt ??
  (inputs.entryType === 'MARKET'
    ? null
    : new Date(now + 7 * 86_400_000).toISOString());

const TABS: Record<PlanTab, readonly PlanStatus[]> = {
  DRAFT: ['DRAFT'],
  ACTIVE: ['ACTIVE'],
  EXECUTED: ['EXECUTED'],
  CANCELLED_EXPIRED: ['CANCELLED', 'EXPIRED', 'INVALIDATED'],
};

function summaryOf(plan: TradingPlan): TradingPlanSummary {
  const created = plan.statusHistory[0]?.at ?? new Date(0).toISOString();
  const at = (status: PlanStatus) =>
    plan.statusHistory.find((change) => change.status === status)?.at ?? null;
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
    activatedAt: at('ACTIVE'),
    expiresAt: plan.expiresAt,
    invalidatedAt: at('INVALIDATED'),
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
      ...(status === 'ACTIVE'
        ? { setupScoreAtPlan: ACTIVATION_SCORE, setupScorePreset: STYLE_PRESET }
        : {}),
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
    const all = [...plans.values()].filter(
      (plan) => plan.market === inputs.market,
    );
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
  /** Futures plans are PRO and PREMIUM only (MSG29), checked first. */
  const marketAllowed = async (inputs: PlanInputs) => {
    if (inputs.market !== 'futures') return;
    const entitlements = (await session())?.entitlements;
    if (
      entitlements &&
      entitlements !== 'unknown' &&
      !entitlements.features.includes('FUTURES_ANALYSIS')
    )
      refuse(403, 'PLAN_FEATURE_NOT_INCLUDED', 'MSG29', ['PRO']);
  };
  const activeLimit = async () => {
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
  };

  let created = 0;
  return {
    async calculate(pairId, inputs, signal) {
      await pause(signal);
      await marketAllowed(inputs);
      checkInputs(inputs);
      enabled(pairId, inputs);
      return calculation(pairId, inputs);
    },
    async create(pairId, inputs, activate) {
      await pause();
      await marketAllowed(inputs);
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
        ...inputs,
        position: null,
        entryPrice: result.entryPrice,
        expectedFillPrice: result.expectedFillPrice,
        plannedEntryPrice: result.entryPrice,
        capital: result.capital,
        riskPercent: result.riskPercent,
        marginMode: inputs.market === 'futures' ? 'ISOLATED' : null,
        expiresAt: expiryOf(inputs, now()),
        analysisTimeframe: inputs.analysisTimeframe ?? STYLE_TIMEFRAME,
        status: 'DRAFT',
        invalidationReason: null,
        setupScoreAtPlan: null,
        setupScorePreset: null,
        editable: true,
        snapshot: result.snapshot,
        warnings: result.warnings,
        blocksActivation: result.blocksActivation,
        statusHistory: [{ status: 'DRAFT', at }],
      };
      plans.set(plan.id, plan);
      return activate ? move(plan, 'ACTIVE') : plan;
    },
    async update(id, inputs, activate) {
      await pause();
      const plan = find(id);
      if (plan.status !== 'DRAFT')
        refuse(409, 'TRADING_PLAN_STATUS_TRANSITION_INVALID', 'MSG43');
      await marketAllowed(inputs);
      checkInputs(inputs);
      const result = calculation(plan.pairId, inputs);
      // An activation refused saves nothing, like the backend.
      if (activate && result.blocksActivation)
        refuse(409, 'TRADING_BLOCKING_WARNING', 'MSG18');
      if (activate) await activeLimit();
      const saved: TradingPlan = {
        ...plan,
        ...inputs,
        entryPrice: result.entryPrice,
        expectedFillPrice: result.expectedFillPrice,
        plannedEntryPrice: result.entryPrice,
        capital: result.capital,
        riskPercent: result.riskPercent,
        expiresAt: expiryOf(inputs, now()),
        analysisTimeframe: inputs.analysisTimeframe ?? STYLE_TIMEFRAME,
        snapshot: result.snapshot,
        warnings: result.warnings,
        blocksActivation: result.blocksActivation,
      };
      plans.set(id, saved);
      return activate ? move(saved, 'ACTIVE') : saved;
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
    // A MARKET draft activated later has moved since its save (scripted
    // 0.40 R): MSG51 until the Trader confirms (TP-C).
    async activate(id, confirmDeviation = false) {
      await pause();
      const plan = find(id);
      if (plan.status !== 'DRAFT')
        refuse(409, 'TRADING_PLAN_STATUS_TRANSITION_INVALID', 'MSG43');
      if (plan.blocksActivation)
        refuse(409, 'TRADING_BLOCKING_WARNING', 'MSG18');
      await activeLimit();
      if (plan.entryType === 'MARKET' && !confirmDeviation)
        throw new ServiceError('Development plan refusal.', 'HTTP_ERROR', 400, {
          status: 400,
          code: 'ENTRY_DEVIATION_CONFIRMATION_REQUIRED',
          messageCode: 'MSG51',
          messageArgs: [
            '0.40000000',
            plan.snapshot.positionQuantity,
            '1.80000000',
          ],
          fieldErrors: {},
          extensions: {
            deviationR: '0.40000000',
            maxDeviationR: plan.maxEntryDeviationR ?? '0.75000000',
            expectedFillPrice: plan.expectedFillPrice ?? plan.entryPrice,
            positionQuantity: plan.snapshot.positionQuantity,
            riskRewardRatio: '1.80000000',
            netRiskReward: '1.52000000',
          },
        });
      return move(plan, 'ACTIVE');
    },
    async cancel(id) {
      await pause();
      const plan = find(id);
      if (plan.status !== 'DRAFT' && plan.status !== 'ACTIVE')
        refuse(409, 'TRADING_PLAN_STATUS_TRANSITION_INVALID', 'MSG43');
      return move(plan, 'CANCELLED');
    },
    // TP-E with its refusals: neither level, a level on the wrong side of
    // the current price (MSG16), no open position (409 MSG43). Risk-profile
    // warnings and the breakeven stop are not recalculated here.
    async changeLevels(id, levels) {
      await pause();
      const plan = find(id);
      const position = plan.position;
      if (!position || position.status !== 'OPEN')
        refuse(409, 'POSITION_NOT_OPEN', 'MSG43');
      if (levels.stopLoss === null && levels.takeProfit === null)
        refuse(400, 'VALIDATION_FAILED', 'MSG01', [], { stopLoss: 'MSG01' });
      const last = position.currentPrice ?? position.fillPrice;
      const long = plan.direction === 'LONG';
      const errors: Record<string, string> = {};
      const below = (value: string) => compareDecimal(value, last) < 0;
      if (levels.stopLoss !== null && below(levels.stopLoss) !== long)
        errors.stopLoss = 'MSG16';
      if (levels.takeProfit !== null && below(levels.takeProfit) === long)
        errors.takeProfit = 'MSG16';
      if (Object.keys(errors).length)
        refuse(400, 'VALIDATION_FAILED', 'MSG01', [], errors);
      const at = now();
      const next: TradingPlan = {
        ...plan,
        position: {
          ...position,
          stopLoss: levels.stopLoss ?? position.stopLoss,
          takeProfit: levels.takeProfit ?? position.takeProfit,
          levelChangeCount: position.levelChangeCount + 1,
          levelChanges: [
            ...position.levelChanges,
            {
              changedAt: new Date(at).toISOString(),
              oldStopLoss: position.stopLoss,
              oldTakeProfit: position.takeProfit,
              newStopLoss: levels.stopLoss ?? position.stopLoss,
              newTakeProfit: levels.takeProfit ?? position.takeProfit,
            },
          ],
          levelsEffectiveFrom: new Date(
            Math.floor(at / 60_000) * 60_000 + 60_000,
          ).toISOString(),
          levelWarnings: [],
        },
      };
      plans.set(id, next);
      return next;
    },
  };
}
