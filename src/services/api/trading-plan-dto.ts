import type {
  PlanDirection,
  PlanEntryType,
  PlanPage,
  PlanSnapshot,
  PlanStatus,
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
 * Decoders for `/plans/**` (SRS 3.5.2, 3.5.3), checked against `develop`
 * @ 0d92def: `TradingPlanSummaryResponse`, `TradingPlanResponse`,
 * `PlanSnapshotResponse`, `PlanWarningResponse`, `StatusChangeResponse`.
 */
const STATUSES: readonly PlanStatus[] = [
  'DRAFT',
  'ACTIVE',
  'EXECUTED',
  'CANCELLED',
  'EXPIRED',
];
const DIRECTIONS: readonly PlanDirection[] = ['LONG', 'SHORT'];
const ENTRY_TYPES: readonly PlanEntryType[] = ['LIMIT', 'MARKET'];
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
];

function nullableInteger(value: unknown, name: string): number | null {
  return value === null || value === undefined ? null : integer(value, name);
}

function common(value: Record<string, unknown>) {
  return {
    id: text(value.id, 'id'),
    pairId: text(value.pairId, 'pairId'),
    market: marketOf(value.market),
    direction: oneOf(DIRECTIONS, value.direction, 'direction'),
    entryType: oneOf(ENTRY_TYPES, value.entryType, 'entryType'),
    entryPrice: decimal(value.entryPrice, 'entryPrice'),
    stopLoss: decimal(value.stopLoss, 'stopLoss'),
    takeProfit: decimal(value.takeProfit, 'takeProfit'),
    leverage: nullableInteger(value.leverage, 'leverage'),
    status: oneOf(STATUSES, value.status, 'status'),
    expiresAt: nullableInstant(value.expiresAt, 'expiresAt'),
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
