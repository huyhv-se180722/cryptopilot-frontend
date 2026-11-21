import type {
  JournalEntry,
  JournalIndicators,
  JournalLearning,
  LiquidityRole,
  PositionCloseReason,
  JournalPage,
  JournalTrade,
  PlanDirection,
  PositionStatus,
  Strategy,
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
  return tradeOf(value);
}

function tradeOf(value: Record<string, unknown>): JournalTrade {
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
    entryFee: nullableDecimal(value.entryFee, 'entryFee'),
    stopLoss: nullableDecimal(value.stopLoss, 'stopLoss'),
    takeProfit: nullableDecimal(value.takeProfit, 'takeProfit'),
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

const LIQUIDITY: readonly LiquidityRole[] = ['MAKER', 'TAKER'];

function nullableFlag(value: unknown, name: string): boolean | null {
  return value === null || value === undefined ? null : flag(value, name);
}

function indicators(value: unknown): JournalIndicators | null {
  if (value === null || value === undefined) return null;
  const v = record(value, 'learning.indicators');
  return {
    timeframe: nullableText(v.timeframe, 'timeframe'),
    openTime: nullableInstant(v.openTime, 'openTime'),
    macdLine: nullableDecimal(v.macdLine, 'macdLine'),
    macdSignal: nullableDecimal(v.macdSignal, 'macdSignal'),
    macdHistogram: nullableDecimal(v.macdHistogram, 'macdHistogram'),
  };
}

function learning(value: unknown): JournalLearning | null {
  if (value === null || value === undefined) return null;
  const v = record(value, 'learning');
  const d = (name: string) => nullableDecimal(v[name], name);
  return {
    plannedEntryPrice: d('plannedEntryPrice'),
    entryDeviationR: d('entryDeviationR'),
    entryLiquidity:
      v.entryLiquidity === null || v.entryLiquidity === undefined
        ? null
        : oneOf(LIQUIDITY, v.entryLiquidity, 'entryLiquidity'),
    riskAmount: d('riskAmount'),
    analysisTimeframe: nullableText(v.analysisTimeframe, 'analysisTimeframe'),
    setupScorePreset: nullableText(v.setupScorePreset, 'setupScorePreset'),
    setupScoreAtPlan: d('setupScoreAtPlan'),
    setupScoreAtFill: d('setupScoreAtFill'),
    setupScoreDropWarned: nullableFlag(
      v.setupScoreDropWarned,
      'setupScoreDropWarned',
    ),
    indicators: indicators(v.indicators),
    maxAdversePrice: d('maxAdversePrice'),
    maxFavorablePrice: d('maxFavorablePrice'),
    rMultiple: d('rMultiple'),
    maeR: d('maeR'),
    mfeR: d('mfeR'),
  };
}

/** Texts the review clears come back null or blank; both are "none". */
function reviewText(value: unknown, name: string): string | null {
  if (value === '') return null;
  return nullableText(value, name);
}

const STORED_IMAGE =
  /\/image\/upload\/(?:v\d+\/)?([^?#]+\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.[A-Za-z0-9]+(?:[?#].*)?$/;

/**
 * The storage key of a stored chart image, read from its address
 * (`…/image/upload/v<version>/<folder>/<owner>/<key>.<format>`), as the
 * mobile app does until the detail returns the key (Q-97). A wrong key is
 * safe: the backend takes it for a new image, finds none signed for the
 * caller and refuses the review with MSG32, so nothing is lost.
 */
export function chartImageKeyOf(url: string | null): string | null {
  return url === null ? null : (STORED_IMAGE.exec(url)?.[1] ?? null);
}

/** `GET /journal/{id}` and the writes that answer with it (SCR-21). */
export function decodeJournalEntry(body: unknown): JournalEntry {
  const value = record(body);
  const url = nullableText(value.chartImageUrl, 'chartImageUrl');
  if (url !== null && new URL(url).protocol !== 'https:')
    throw new Error('chartImageUrl must be https');
  return {
    trade: tradeOf(value),
    strategyId: nullableText(value.strategyId, 'strategyId'),
    strategyName: nullableText(value.strategyName, 'strategyName'),
    setupDescription: reviewText(value.setupDescription, 'setupDescription'),
    lessonsLearned: reviewText(value.lessonsLearned, 'lessonsLearned'),
    mistakes: reviewText(value.mistakes, 'mistakes'),
    chartImageUrl: url,
    chartImageKey: chartImageKeyOf(url),
    learning: learning(value.learning),
  };
}

/** `GET /strategies`: every strategy a Trader can choose. */
export function decodeStrategies(body: unknown): readonly Strategy[] {
  return list(body, 'strategies').map((item, index) => {
    const value = record(item, 'strategies[' + index + ']');
    return { id: text(value.id, 'id'), name: text(value.name, 'name') };
  });
}

/** The signed form of `POST /journal/{id}/chart-image/upload-signature`. */
export interface ChartImageForm {
  uploadUrl: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  publicId: string;
  allowedFormats: readonly string[];
  maxBytes: number;
}

export function decodeChartImageForm(body: unknown): ChartImageForm {
  const value = record(body);
  const uploadUrl = text(value.uploadUrl, 'uploadUrl');
  if (new URL(uploadUrl).protocol !== 'https:')
    throw new Error('uploadUrl must be https');
  const maxBytes = integer(value.maxBytes, 'maxBytes');
  if (maxBytes <= 0) throw new Error('maxBytes must be positive');
  return {
    uploadUrl,
    apiKey: text(value.apiKey, 'apiKey'),
    timestamp: integer(value.timestamp, 'timestamp'),
    signature: text(value.signature, 'signature'),
    publicId: text(value.publicId, 'publicId'),
    allowedFormats: list(value.allowedFormats, 'allowedFormats').map((f) =>
      text(f, 'allowedFormat').toLowerCase(),
    ),
    maxBytes,
  };
}
