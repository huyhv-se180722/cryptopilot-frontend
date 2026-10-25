import type {
  PlanCalculation,
  PlanDirection,
  PlanInputs,
  PlanEntryType,
  PlanInvalidationReason,
  PlanPage,
  PlanSnapshot,
  PlanStatus,
  PlanTimeframe,
  PlanWarning,
  PlanWarningType,
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

/**
 * Decoders for `/plans/**` (SRS 3.5.1–3.5.3), checked against `develop`
 * @ 233fcc8: `TradingPlanSummaryResponse`, `TradingPlanResponse`,
 * `PlanSnapshotResponse`, `PlanWarningResponse`, `StatusChangeResponse`,
 * `PlanCalculationResponse`, `CreateTradingPlanRequest`,
 * `UpdateTradingPlanRequest`. Plan validity (STOP entry, INVALIDATED, the
 * invalidation price, the deviation limit, the analysis timeframe and the
 * setup score at activation) against `feature/TP-A-plan-validity` @
 * 112aa24; the expected fill and the cost figures (D-116) against `develop`
 * @ dccfc6c. Those fields are read as null when absent, as an older backend
 * answers.
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
const TIMEFRAMES: readonly PlanTimeframe[] = ['15m', '1h', '4h', '1d'];
const REASONS: readonly PlanInvalidationReason[] = [
  'TAKE_PROFIT_REACHED',
  'STOP_LOSS_REACHED',
  'INVALIDATION_PRICE',
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
  allowed: readonly T[],
  value: unknown,
  name: string,
): T | null {
  return value === null || value === undefined
    ? null
    : oneOf(allowed, value, name);
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
    estimatedEntryFee: nullableDecimal(
      s.estimatedEntryFee,
      'estimatedEntryFee',
    ),
    estimatedStopLossExitFee: nullableDecimal(
      s.estimatedStopLossExitFee,
      'estimatedStopLossExitFee',
    ),
    estimatedTakeProfitExitFee: nullableDecimal(
      s.estimatedTakeProfitExitFee,
      'estimatedTakeProfitExitFee',
    ),
    estimatedSlippage: nullableDecimal(
      s.estimatedSlippage,
      'estimatedSlippage',
    ),
    lossAtStopLoss: nullableDecimal(s.lossAtStopLoss, 'lossAtStopLoss'),
    feeShareOfRisk: nullableDecimal(s.feeShareOfRisk, 'feeShareOfRisk'),
    netRiskReward: nullableDecimal(s.netRiskReward, 'netRiskReward'),
  };
}

/** The server's English sentence is for developers; the UI words the type. */
function warning(item: unknown): PlanWarning {
  const value = record(item, 'warning');
  return {
    type: oneOf(WARNING_TYPES, value.type, 'warning.type'),
    severity: oneOf(SEVERITIES, value.severity, 'warning.severity'),
  };
}

/** `GET /plans/{id}` and the activate / cancel answers. */
export function decodePlan(body: unknown): TradingPlan {
  const value = record(body);
  const margin = value.marginMode;
  if (margin !== null && margin !== undefined && margin !== 'ISOLATED')
    throw new Error('marginMode is not ISOLATED');
  return {
    ...common(value),
    capital: decimal(value.capital, 'capital'),
    riskPercent: decimal(value.riskPercent, 'riskPercent'),
    marginMode: margin === 'ISOLATED' ? 'ISOLATED' : null,
    note: nullableText(value.note, 'note'),
    plannedEntryPrice: nullableDecimal(
      value.plannedEntryPrice,
      'plannedEntryPrice',
    ),
    invalidationPrice: nullableDecimal(
      value.invalidationPrice,
      'invalidationPrice',
    ),
    maxEntryDeviationR: nullableDecimal(
      value.maxEntryDeviationR,
      'maxEntryDeviationR',
    ),
    analysisTimeframe: nullableOneOf(
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

/** The inputs as `CreateTradingPlanRequest` / `UpdateTradingPlanRequest` take them. */
export function encodePlanInputs(inputs: PlanInputs) {
  return {
    market: inputs.market.toUpperCase(),
    direction: inputs.direction,
    entryType: inputs.entryType,
    entryPrice: inputs.entryPrice,
    stopLoss: inputs.stopLoss,
    takeProfit: inputs.takeProfit,
    capital: inputs.capital,
    riskPercent: inputs.riskPercent,
    leverage: inputs.leverage,
    expiresAt: inputs.expiresAt,
    note: inputs.note,
    invalidationPrice: inputs.invalidationPrice,
    maxEntryDeviationR: inputs.maxEntryDeviationR,
    analysisTimeframe: inputs.analysisTimeframe,
  };
}
