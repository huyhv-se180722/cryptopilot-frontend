import type {
  Alert,
  AlertCondition,
  AlertIndicator,
  AlertPage,
  AlertRule,
  AlertStatus,
  AlertTriggerMode,
  AlertType,
  CandleTimeframe,
  Watchlist,
  WatchlistItem,
} from '../../types/domain';
import {
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
 * Decoders for `/watchlist/**` and `/alerts/**` (SRS 3.4.1–3.4.3), checked
 * against `develop` @ 233fcc8: `WatchlistResponse`, `WatchlistItemResponse`,
 * `AlertResponse`, `CreateAlertRequest`, `UpdateAlertRequest`.
 */
const TYPES: readonly AlertType[] = ['PRICE', 'INDICATOR'];
const INDICATORS: readonly AlertIndicator[] = [
  'RSI_14',
  'MACD_CROSS',
  'EMA_CROSS',
  'FUNDING_RATE',
  'OPEN_INTEREST_CHANGE',
];
const CONDITIONS: readonly AlertCondition[] = [
  'CROSS_ABOVE',
  'CROSS_BELOW',
  'GREATER_THAN',
  'LESS_THAN',
];
const MODES: readonly AlertTriggerMode[] = [
  'ONCE',
  'ONCE_PER_BAR',
  'EVERY_TIME',
];
const STATUSES: readonly AlertStatus[] = [
  'ACTIVE',
  'PAUSED',
  'TRIGGERED',
  'EXPIRED',
];
const TIMEFRAMES: readonly CandleTimeframe[] = ['15m', '1h', '4h', '1d'];

function nullableInteger(value: unknown, name: string): number | null {
  return value === null || value === undefined ? null : integer(value, name);
}

/** One row of `GET /watchlist`, or the answer of POST / PATCH. */
export function decodeWatchlistItem(body: unknown): WatchlistItem {
  const value = record(body, 'item');
  return {
    id: text(value.id, 'id'),
    pairId: text(value.pairId, 'pairId'),
    symbol: text(value.symbol, 'symbol'),
    spotListed: flag(value.spotListed, 'spotListed'),
    futuresListed: flag(value.futuresListed, 'futuresListed'),
    label: nullableText(value.label, 'label'),
    note: nullableText(value.note, 'note'),
    sortOrder: integer(value.sortOrder, 'sortOrder'),
    activeAlerts: integer(value.activeAlerts, 'activeAlerts'),
    addedAt: instant(value.addedAt, 'addedAt'),
  };
}

export function decodeWatchlist(body: unknown): Watchlist {
  const value = record(body);
  return {
    items: list(value.items, 'items').map(decodeWatchlistItem),
    limit: nullableInteger(value.limit, 'limit'),
  };
}

export function decodeAlert(body: unknown): Alert {
  const value = record(body, 'alert');
  const indicator = value.indicator;
  const timeframe = value.timeframe;
  return {
    id: text(value.id, 'id'),
    watchlistId: text(value.watchlistId, 'watchlistId'),
    pairId: text(value.pairId, 'pairId'),
    symbol: text(value.symbol, 'symbol'),
    market: marketOf(value.market),
    type: oneOf(TYPES, value.type, 'type'),
    indicator:
      indicator === null || indicator === undefined
        ? null
        : oneOf(INDICATORS, indicator, 'indicator'),
    timeframe:
      timeframe === null || timeframe === undefined
        ? null
        : oneOf(TIMEFRAMES, timeframe, 'timeframe'),
    condition: oneOf(CONDITIONS, value.condition, 'condition'),
    threshold: nullableDecimal(value.threshold, 'threshold'),
    triggerMode: oneOf(MODES, value.triggerMode, 'triggerMode'),
    cooldownMinutes: nullableInteger(value.cooldownMinutes, 'cooldownMinutes'),
    notifyEmail: flag(value.notifyEmail, 'notifyEmail'),
    notifyPush: flag(value.notifyPush, 'notifyPush'),
    status: oneOf(STATUSES, value.status, 'status'),
    triggerCount: integer(value.triggerCount, 'triggerCount'),
    lastTriggeredAt: nullableInstant(value.lastTriggeredAt, 'lastTriggeredAt'),
    expiresAt: nullableInstant(value.expiresAt, 'expiresAt'),
    createdAt: instant(value.createdAt, 'createdAt'),
  };
}

/** `GET /alerts`: a page of alerts, newest first. */
export function decodeAlertPage(body: unknown): AlertPage {
  const value = record(body);
  return {
    items: list(value.items, 'items').map(decodeAlert),
    page: integer(value.page, 'page'),
    pageSize: integer(value.pageSize, 'pageSize'),
    total: integer(value.total, 'total'),
  };
}

/** The rule as `CreateAlertRequest` / `UpdateAlertRequest` take it. */
export function encodeAlertRule(rule: AlertRule) {
  return {
    market: rule.market.toUpperCase(),
    type: rule.type,
    indicator: rule.indicator,
    timeframe: rule.timeframe,
    condition: rule.condition,
    threshold: rule.threshold,
    triggerMode: rule.triggerMode,
    cooldownMinutes: rule.cooldownMinutes,
    notifyEmail: rule.notifyEmail,
    notifyPush: rule.notifyPush,
    expiresAt: rule.expiresAt,
  };
}
