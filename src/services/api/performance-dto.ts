import type {
  EquityPoint,
  PerformanceAdvanced,
  PerformanceBreakdownRow,
  PerformanceSummary,
} from '../../types/domain';
import {
  decimal,
  integer,
  list,
  nullableDecimal,
  nullableText,
  record,
  text,
} from './decode';

/**
 * Decoders for `/journal/performance/*` (SCR-23), checked against T-051.
 * The OpenAPI does not mark what is nullable: every ratio, mean and amount
 * is read as nullable and shown as a dash.
 */

function advanced(body: unknown): PerformanceAdvanced | null {
  if (body === null || body === undefined) return null;
  const value = record(body, 'advanced');
  return {
    averageWin: nullableDecimal(value.averageWin, 'averageWin'),
    averageLoss: nullableDecimal(value.averageLoss, 'averageLoss'),
    profitFactor: nullableDecimal(value.profitFactor, 'profitFactor'),
    averagePlannedRiskReward: nullableDecimal(
      value.averagePlannedRiskReward,
      'averagePlannedRiskReward',
    ),
    averageRealizedR: nullableDecimal(
      value.averageRealizedR,
      'averageRealizedR',
    ),
    tradesWithR: integer(value.tradesWithR, 'tradesWithR'),
    largestWin: nullableDecimal(value.largestWin, 'largestWin'),
    largestLoss: nullableDecimal(value.largestLoss, 'largestLoss'),
    maxConsecutiveLosses: integer(
      value.maxConsecutiveLosses,
      'maxConsecutiveLosses',
    ),
    maxDrawdown: nullableDecimal(value.maxDrawdown, 'maxDrawdown'),
    averageEntryDeviationR: nullableDecimal(
      value.averageEntryDeviationR,
      'averageEntryDeviationR',
    ),
    costOfLateEntryR: nullableDecimal(
      value.costOfLateEntryR,
      'costOfLateEntryR',
    ),
    averageMaeR: nullableDecimal(value.averageMaeR, 'averageMaeR'),
    averageMfeR: nullableDecimal(value.averageMfeR, 'averageMfeR'),
  };
}

export function decodePerformanceSummary(body: unknown): PerformanceSummary {
  const value = record(body);
  return {
    from: nullableText(value.from, 'from'),
    to: nullableText(value.to, 'to'),
    trades: integer(value.trades, 'trades'),
    wins: integer(value.wins, 'wins'),
    losses: integer(value.losses, 'losses'),
    breakeven: integer(value.breakeven, 'breakeven'),
    winRate: nullableDecimal(value.winRate, 'winRate'),
    totalNetPnl: nullableDecimal(value.totalNetPnl, 'totalNetPnl'),
    provisionalTrades: integer(value.provisionalTrades, 'provisionalTrades'),
    totalFees: nullableDecimal(value.totalFees, 'totalFees'),
    totalFunding: nullableDecimal(value.totalFunding, 'totalFunding'),
    advanced: advanced(value.advanced),
  };
}

function breakdownRow(item: unknown, index: number): PerformanceBreakdownRow {
  const value = record(item, 'rows[' + index + ']');
  return {
    key: nullableText(value.key, 'key'),
    // by-coin has no label for a pair it no longer finds: its id stands in.
    label: text(value.label ?? value.key, 'label'),
    trades: integer(value.trades, 'trades'),
    wins: integer(value.wins, 'wins'),
    losses: integer(value.losses, 'losses'),
    breakeven: integer(value.breakeven, 'breakeven'),
    winRate: nullableDecimal(value.winRate, 'winRate'),
    netPnl: nullableDecimal(value.netPnl, 'netPnl'),
    profitFactor: nullableDecimal(value.profitFactor, 'profitFactor'),
    averageRealizedR: nullableDecimal(
      value.averageRealizedR,
      'averageRealizedR',
    ),
  };
}

export function decodePerformanceBreakdown(
  body: unknown,
): readonly PerformanceBreakdownRow[] {
  return list(body, 'body').map(breakdownRow);
}

export function decodeEquityCurve(body: unknown): readonly EquityPoint[] {
  return list(body, 'body').map((item, index) => {
    const value = record(item, 'points[' + index + ']');
    return {
      day: text(value.day, 'day'),
      trades: integer(value.trades, 'trades'),
      netPnl: decimal(value.netPnl, 'netPnl'),
      cumulativeNetPnl: decimal(value.cumulativeNetPnl, 'cumulativeNetPnl'),
    };
  });
}
