import type {
  CandleTimeframe,
  CloseEstimate,
  CloseReason,
  EntryDeviation,
  InvalidationReason,
  PlanCalculation,
  PlanDirection,
  PlanInputs,
  PlanEntryType,
  PlanPage,
  PlanPosition,
  PlanSnapshot,
  PlanStatus,
  PlanWarning,
  PlanWarningType,
  PositionStatus,
  TradingPlan,
  TradingPlanSummary,
  WarningSeverity,
} from '../../types/domain';
import {
  decimal,
  flag,
  instant,
  integer,
  list,
  nullableDecimal,
  nullableInstant,
  nullableText,
  oneOf,
  record,
  text,
} from './decode';
import { marketOf } from './market-dto';
import type { ApiProblem } from './problem';

/**
 * Decoders for `/plans/**` (SRS 3.5.1–3.5.3), checked against the FE guide
 * `modules/trading-plan.md` of 2026-10-25 (TP-A, TP-0, TP-B, TP-C, TP-D,
 * T-048a, T-048b) and backend `develop` @ df573af:
 * `TradingPlanSummaryResponse`, `TradingPlanResponse`, `PositionResponse`,
 * `PlanSnapshotResponse`, `PlanWarningResponse`, `StatusChangeResponse`,
 * `PlanCalculationResponse`, `CreateTradingPlanRequest`,
 * `UpdateTradingPlanRequest`. An unknown status or entry type is refused;
 * an unknown warning type is kept as UNKNOWN (ADR-009).
 */
const STATUSES: readonly PlanStatus[] = [
  'DRAFT',
  'ACTIVE',
  'EXECUTED',
  'CANCELLED',
  'EXPIRED',
  'INVALIDATED',
];
const DIRECTIONS: readonly PlanDirection[] = ['LONG', 'SHORT'];
const ENTRY_TYPES: readonly PlanEntryType[] = ['LIMIT', 'MARKET', 'STOP'];
const REASONS: readonly InvalidationReason[] = [
  'TAKE_PROFIT_REACHED',
  'STOP_LOSS_REACHED',
  'INVALIDATION_PRICE',
];
const TIMEFRAMES: readonly CandleTimeframe[] = ['15m', '1h', '4h', '1d'];
const POSITION_STATUSES: readonly PositionStatus[] = ['OPEN', 'CLOSED'];
const CLOSE_REASONS: readonly CloseReason[] = [
  'TAKE_PROFIT',
  'STOP_LOSS',
  'LIQUIDATION',
  'MANUAL',
];
const SEVERITIES: readonly WarningSeverity[] = ['INFO', 'WARNING', 'BLOCKING'];
const WARNING_TYPES: readonly PlanWarningType[] = [
  'INSUFFICIENT_CAPITAL',
  'SL_BEYOND_LIQUIDATION',
  'LOW_RR',
  'OVERSIZED_POSITION',
  'HIGH_LEVERAGE',
  'TOTAL_OPEN_RISK',
  'WIDE_STOP_LOSS',
  'HIGH_FUNDING_RATE',
  'HIGH_FEE_SHARE',
];

function nullableInteger(value: unknown, name: string): number | null {
  return value === null || value === undefined ? null : integer(value, name);
}
function nullableOneOf<T extends string>(
  values: readonly T[],
  value: unknown,
  name: string,
): T | null {
  return value === null || value === undefined
    ? null
    : oneOf(values, value, name);
}

function common(value: Record<string, unknown>) {
  return {
    id: text(value.id, 'id'),
    pairId: text(value.pairId, 'pairId'),
    market: marketOf(value.market),
    direction: oneOf(DIRECTIONS, value.direction, 'direction'),
    entryType: oneOf(ENTRY_TYPES, value.entryType, 'entryType'),
    entryPrice: decimal(value.entryPrice, 'entryPrice'),
    expectedFillPrice: nullableDecimal(
      value.expectedFillPrice,
      'expectedFillPrice',
    ),
    stopLoss: decimal(value.stopLoss, 'stopLoss'),
    takeProfit: decimal(value.takeProfit, 'takeProfit'),
    leverage: nullableInteger(value.leverage, 'leverage'),
    status: oneOf(STATUSES, value.status, 'status'),
    expiresAt: nullableInstant(value.expiresAt, 'expiresAt'),
    invalidationReason: nullableOneOf(
      REASONS,
      value.invalidationReason,
      'invalidationReason',
    ),
  };
}

function summary(item: unknown, index: number): TradingPlanSummary {
  const value = record(item, 'items[' + index + ']');
  return {
    ...common(value),
    riskAmount: decimal(value.riskAmount, 'riskAmount'),
    riskRewardRatio: decimal(value.riskRewardRatio, 'riskRewardRatio'),
    createdAt: instant(value.createdAt, 'createdAt'),
    activatedAt: nullableInstant(value.activatedAt, 'activatedAt'),
    invalidatedAt: nullableInstant(value.invalidatedAt, 'invalidatedAt'),
    positionStatus: nullableOneOf(
      POSITION_STATUSES,
      value.positionStatus,
      'positionStatus',
    ),
  };
}

/** `GET /plans`: a page of rows, newest first. */
export function decodePlanPage(body: unknown): PlanPage {
  const value = record(body);
  return {
    items: list(value.items, 'items').map(summary),
    page: integer(value.page, 'page'),
    pageSize: integer(value.pageSize, 'pageSize'),
    total: integer(value.total, 'total'),
  };
}

function snapshot(value: unknown): PlanSnapshot {
  const s = record(value, 'snapshot');
  const cost = (name: string) => nullableDecimal(s[name], 'snapshot.' + name);
  return {
    positionQuantity: decimal(s.positionQuantity, 'positionQuantity'),
    notionalValue: decimal(s.notionalValue, 'notionalValue'),
    initialMargin: nullableDecimal(s.initialMargin, 'initialMargin'),
    maintenanceMarginRateUsed: nullableDecimal(
      s.maintenanceMarginRateUsed,
      'maintenanceMarginRateUsed',
    ),
    riskAmount: decimal(s.riskAmount, 'riskAmount'),
    rewardAmount: decimal(s.rewardAmount, 'rewardAmount'),
    riskRewardRatio: decimal(s.riskRewardRatio, 'riskRewardRatio'),
    estimatedLiquidationPrice: nullableDecimal(
      s.estimatedLiquidationPrice,
      'estimatedLiquidationPrice',
    ),
    // TP-0: null on a plan saved before it.
    estimatedEntryFee: cost('estimatedEntryFee'),
    estimatedStopLossExitFee: cost('estimatedStopLossExitFee'),
    estimatedTakeProfitExitFee: cost('estimatedTakeProfitExitFee'),
    estimatedSlippage: cost('estimatedSlippage'),
    lossAtStopLoss: cost('lossAtStopLoss'),
    feeShareOfRisk: cost('feeShareOfRisk'),
    netRiskReward: cost('netRiskReward'),
  };
}

/**
 * The server's English sentence is for developers; the UI words the type.
 * A type this client does not know yet stays on screen as UNKNOWN with its
 * severity (ADR-009); the severity itself must be one of the three.
 */
function warning(item: unknown): PlanWarning {
  const value = record(item, 'warning');
  const type = text(value.type, 'warning.type');
  const severity = oneOf(SEVERITIES, value.severity, 'warning.severity');
  return WARNING_TYPES.includes(type as PlanWarningType)
    ? { type: type as PlanWarningType, severity }
    : { type: 'UNKNOWN', severity, rawType: type };
}

/**
 * `TradingPlanResponse.position`: null until EXECUTED. The CLOSED fields of
 * T-048b may be absent from a backend without it; absent counts as null.
 */
function position(value: unknown): PlanPosition | null {
  if (value === null || value === undefined) return null;
  const p = record(value, 'position');
  const amount = (name: string) => nullableDecimal(p[name], 'position.' + name);
  return {
    status: oneOf(POSITION_STATUSES, p.status, 'position.status'),
    fillPrice: decimal(p.fillPrice, 'position.fillPrice'),
    quantity: decimal(p.quantity, 'position.quantity'),
    entryTime: instant(p.entryTime, 'position.entryTime'),
    entryFee: decimal(p.entryFee, 'position.entryFee'),
    liquidationPrice: amount('liquidationPrice'),
    currentPrice: amount('currentPrice'),
    unrealizedPnl: amount('unrealizedPnl'),
    exitPrice: amount('exitPrice'),
    exitTime: nullableInstant(p.exitTime, 'position.exitTime'),
    closeReason: nullableOneOf(
      CLOSE_REASONS,
      p.closeReason,
      'position.closeReason',
    ),
    realizedPnl: amount('realizedPnl'),
    feeAmount: amount('feeAmount'),
    fundingFeeAmount: amount('fundingFeeAmount'),
    netPnl: amount('netPnl'),
    provisional:
      p.provisional === null || p.provisional === undefined
        ? false
        : flag(p.provisional, 'position.provisional'),
  };
}

/** `GET /plans/{id}` and the create / update / activate / cancel answers. */
export function decodePlan(body: unknown): TradingPlan {
  const value = record(body);
  const margin = value.marginMode;
  if (margin !== null && margin !== undefined && margin !== 'ISOLATED')
    throw new Error('marginMode is not ISOLATED');
  return {
    ...common(value),
    plannedEntryPrice: nullableDecimal(
      value.plannedEntryPrice,
      'plannedEntryPrice',
    ),
    capital: decimal(value.capital, 'capital'),
    riskPercent: decimal(value.riskPercent, 'riskPercent'),
    marginMode: margin === 'ISOLATED' ? 'ISOLATED' : null,
    note: nullableText(value.note, 'note'),
    invalidationPrice: nullableDecimal(
      value.invalidationPrice,
      'invalidationPrice',
    ),
    maxEntryDeviationR: nullableDecimal(
      value.maxEntryDeviationR,
      'maxEntryDeviationR',
    ),
    analysisTimeframe: oneOf(
      TIMEFRAMES,
      value.analysisTimeframe,
      'analysisTimeframe',
    ),
    setupScoreAtPlan: nullableDecimal(
      value.setupScoreAtPlan,
      'setupScoreAtPlan',
    ),
    setupScorePreset: nullableText(value.setupScorePreset, 'setupScorePreset'),
    editable: flag(value.editable, 'editable'),
    snapshot: snapshot(value.snapshot),
    warnings: list(value.warnings, 'warnings').map(warning),
    blocksActivation: flag(value.blocksActivation, 'blocksActivation'),
    statusHistory: list(value.statusHistory, 'statusHistory').map((item) => {
      const change = record(item, 'statusHistory');
      return {
        status: oneOf(STATUSES, change.status, 'statusHistory.status'),
        at: instant(change.at, 'statusHistory.at'),
      };
    }),
    position: position(value.position),
  };
}

/** `POST /plans/calculate`: the risk panel of SCR-17 (`PlanCalculationResponse`). */
export function decodeCalculation(body: unknown): PlanCalculation {
  const value = record(body);
  return {
    entryPrice: decimal(value.entryPrice, 'entryPrice'),
    expectedFillPrice: nullableDecimal(
      value.expectedFillPrice,
      'expectedFillPrice',
    ),
    capital: decimal(value.capital, 'capital'),
    riskPercent: decimal(value.riskPercent, 'riskPercent'),
    snapshot: snapshot(value.snapshot),
    warnings: list(value.warnings, 'warnings').map(warning),
    blocksActivation: flag(value.blocksActivation, 'blocksActivation'),
  };
}

/**
 * The inputs as `CreateTradingPlanRequest` / `UpdateTradingPlanRequest`
 * take them. No `capital`: since TP-D (backend PR #73) every plan is sized
 * on the profile's default capital and a sent value is ignored.
 */
export function encodePlanInputs(inputs: PlanInputs) {
  return {
    market: inputs.market.toUpperCase(),
    direction: inputs.direction,
    entryType: inputs.entryType,
    entryPrice: inputs.entryType === 'MARKET' ? null : inputs.entryPrice,
    stopLoss: inputs.stopLoss,
    takeProfit: inputs.takeProfit,
    riskPercent: inputs.riskPercent,
    leverage: inputs.leverage,
    expiresAt: inputs.expiresAt,
    note: inputs.note,
    // A MARKET plan with an invalidation price is refused (MSG01).
    invalidationPrice:
      inputs.entryType === 'MARKET' ? null : inputs.invalidationPrice,
    maxEntryDeviationR: inputs.maxEntryDeviationR,
    analysisTimeframe: inputs.analysisTimeframe,
  };
}

/** The two refusals of a moved MARKET entry at activation (TP-C). */
export const DEVIATION_CONFIRM = 'ENTRY_DEVIATION_CONFIRMATION_REQUIRED';
export const DEVIATION_REFUSED = 'ENTRY_DEVIATION_REFUSED';

/**
 * The extension members of MSG51 (400) or MSG52 (409), or null when the
 * problem is neither or lacks them. MSG51 carries the recalculated
 * quantity and R:R; MSG52 whether the take profit was reached.
 */
export function decodeDeviation(
  problem: ApiProblem | undefined,
): EntryDeviation | null {
  if (
    !problem ||
    (problem.code !== DEVIATION_CONFIRM && problem.code !== DEVIATION_REFUSED)
  )
    return null;
  const x = problem.extensions ?? {};
  const text = (key: string) => {
    const value = x[key];
    return typeof value === 'string' ? value : null;
  };
  const deviationR = text('deviationR');
  const maxDeviationR = text('maxDeviationR');
  const expectedFillPrice = text('expectedFillPrice');
  if (
    deviationR === null ||
    maxDeviationR === null ||
    expectedFillPrice === null
  )
    return null;
  return {
    deviationR,
    maxDeviationR,
    expectedFillPrice,
    positionQuantity: text('positionQuantity'),
    riskRewardRatio: text('riskRewardRatio'),
    netRiskReward: text('netRiskReward'),
    takeProfitReached: x.takeProfitReached === true,
  };
}

/**
 * `GET /plans/{id}/close-estimate` (SCR-19, T-046): the contract of the
 * team lead of 2026-10-25; the FE guide does not document it yet. The
 * funding is null on Spot.
 */
export function decodeCloseEstimate(body: unknown): CloseEstimate {
  const value = record(body);
  return {
    currentPrice: decimal(value.currentPrice, 'currentPrice'),
    estimatedExitPrice: decimal(value.estimatedExitPrice, 'estimatedExitPrice'),
    priceResult: decimal(value.priceResult, 'priceResult'),
    entryFee: decimal(value.entryFee, 'entryFee'),
    estimatedExitFee: decimal(value.estimatedExitFee, 'estimatedExitFee'),
    fundingSoFar: nullableDecimal(value.fundingSoFar, 'fundingSoFar'),
    fundingProvisional: flag(value.fundingProvisional, 'fundingProvisional'),
    estimatedNetPnl: decimal(value.estimatedNetPnl, 'estimatedNetPnl'),
    at: instant(value.at, 'at'),
  };
}
