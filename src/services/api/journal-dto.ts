import type {
  PositionCloseReason,
  JournalPage,
  JournalTrade,
  PlanDirection,
  PositionStatus,
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
 * Decoders for `GET /journal` (SCR-20, UC-22). Decimals are strings; the
 * exit and its amounts are null while the trade is OPEN.
 */

const DIRECTIONS: readonly PlanDirection[] = ['LONG', 'SHORT'];
const SOURCES: readonly JournalTrade['source'][] = ['SIMULATED', 'MANUAL'];
const STATUSES: readonly PositionStatus[] = ['OPEN', 'CLOSED'];
const CLOSE_REASONS: readonly PositionCloseReason[] = [
  'TAKE_PROFIT',
  'STOP_LOSS',
  'LIQUIDATION',
  'MANUAL',
];

function nullableInteger(value: unknown, name: string): number | null {
  return value === null || value === undefined ? null : integer(value, name);
}

function trade(item: unknown, index: number): JournalTrade {
  const value = record(item, 'items[' + index + ']');
  return {
    id: text(value.id, 'id'),
    planId: nullableText(value.planId, 'planId'),
    pairId: text(value.pairId, 'pairId'),
    market: marketOf(value.market),
    direction: oneOf(DIRECTIONS, value.direction, 'direction'),
    source: oneOf(SOURCES, value.source, 'source'),
    status: oneOf(STATUSES, value.status, 'status'),
    leverage: nullableInteger(value.leverage, 'leverage'),
    entryPrice: decimal(value.entryPrice, 'entryPrice'),
    quantity: decimal(value.quantity, 'quantity'),
    entryTime: instant(value.entryTime, 'entryTime'),
    exitPrice: nullableDecimal(value.exitPrice, 'exitPrice'),
    exitTime: nullableInstant(value.exitTime, 'exitTime'),
    closeReason:
      value.closeReason === null || value.closeReason === undefined
        ? null
        : oneOf(CLOSE_REASONS, value.closeReason, 'closeReason'),
    realizedPnl: nullableDecimal(value.realizedPnl, 'realizedPnl'),
    feeAmount: nullableDecimal(value.feeAmount, 'feeAmount'),
    fundingFeeAmount: nullableDecimal(
      value.fundingFeeAmount,
      'fundingFeeAmount',
    ),
    netPnl: nullableDecimal(value.netPnl, 'netPnl'),
    provisional: flag(value.provisional, 'provisional'),
  };
}

/** `GET /journal`: a page of trades, the latest entry first. */
export function decodeJournalPage(body: unknown): JournalPage {
  const value = record(body);
  return {
    items: list(value.items, 'items').map(trade),
    page: integer(value.page, 'page'),
    pageSize: integer(value.pageSize, 'pageSize'),
    total: integer(value.total, 'total'),
  };
}
