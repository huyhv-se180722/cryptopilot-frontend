import type {
  JournalService,
  PerformanceService,
} from '../services/api/contracts';
import { ServiceError } from '../services/api/errors';
import type {
  EquityPoint,
  JournalEntry,
  ManualTradeInput,
  PerformanceAdvanced,
  PerformanceBreakdownRow,
  PerformanceFilter,
  Session,
} from '../types/domain';
import { addDays, businessDay } from '../utils/business-day';
import { add, compare, divide, subtract } from '../utils/decimal-math';
import {
  devJournalStrategies,
  devJournalTrades,
  type DevTrade,
} from './fixtures/journal';
import { devPairs } from './fixtures/market';

function refuse(
  status: number,
  code: string,
  messageCode: string,
  messageArgs: readonly string[] = [],
  fieldErrors: Readonly<Record<string, string>> = {},
): never {
  throw new ServiceError('Development journal refusal.', 'HTTP_ERROR', status, {
    status,
    code,
    messageCode,
    messageArgs,
    fieldErrors,
  });
}

const net = (trade: DevTrade) => trade.netPnl ?? '0';
const sum = (values: readonly string[]) =>
  values.reduce((total, value) => add(total, value), '0');
const ratio = (a: string, b: string) => divide(a, b, 8, 'half-up');
const mean = (values: readonly string[]) =>
  values.length ? ratio(sum(values), String(values.length)) : null;
const exitDay = (trade: DevTrade) =>
  businessDay(Date.parse(trade.exitTime ?? trade.entryTime));

function counts(trades: readonly DevTrade[]) {
  const wins = trades.filter((trade) => compare(net(trade), '0') > 0);
  const losses = trades.filter((trade) => compare(net(trade), '0') < 0);
  const decided = wins.length + losses.length;
  return {
    trades: trades.length,
    wins: wins.length,
    losses: losses.length,
    breakeven: trades.length - decided,
    winRate: decided ? ratio(String(wins.length), String(decided)) : null,
    winners: wins,
    losers: losses,
  };
}

function profitFactor(
  winners: readonly DevTrade[],
  losers: readonly DevTrade[],
) {
  const loss = subtract('0', sum(losers.map(net)));
  return losers.length ? ratio(sum(winners.map(net)), loss) : null;
}

function realizedR(trades: readonly DevTrade[]) {
  return mean(trades.map((trade) => ratio(net(trade), trade.risk)));
}

function curve(trades: readonly DevTrade[]): readonly EquityPoint[] {
  const days = new Map<string, DevTrade[]>();
  const ordered = [...trades].sort((a, b) =>
    exitDay(a).localeCompare(exitDay(b)),
  );
  for (const trade of ordered)
    days.set(exitDay(trade), [...(days.get(exitDay(trade)) ?? []), trade]);
  let cumulative = '0';
  return [...days].map(([day, closed]) => {
    const netPnl = sum(closed.map(net));
    cumulative = add(cumulative, netPnl);
    return {
      day,
      trades: closed.length,
      netPnl,
      cumulativeNetPnl: cumulative,
    };
  });
}

function advanced(trades: readonly DevTrade[]): PerformanceAdvanced {
  const { winners, losers } = counts(trades);
  let peak = '0';
  let drawdown = '0';
  let run = 0;
  let longest = 0;
  for (const point of curve(trades)) {
    if (compare(point.cumulativeNetPnl, peak) > 0)
      peak = point.cumulativeNetPnl;
    const fall = subtract(peak, point.cumulativeNetPnl);
    if (compare(fall, drawdown) > 0) drawdown = fall;
  }
  for (const trade of trades) {
    run = compare(net(trade), '0') < 0 ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  const sorted = [...trades].sort((a, b) => compare(net(a), net(b)));
  return {
    averageWin: mean(winners.map(net)),
    averageLoss: mean(losers.map(net)),
    profitFactor: profitFactor(winners, losers),
    averagePlannedRiskReward: '2.00000000',
    averageRealizedR: realizedR(trades),
    tradesWithR: trades.length,
    largestWin: winners.length ? net(sorted.at(-1) as DevTrade) : null,
    largestLoss: losers.length ? net(sorted[0] as DevTrade) : null,
    maxConsecutiveLosses: longest,
    maxDrawdown: drawdown,
    averageEntryDeviationR: null,
    costOfLateEntryR: null,
    averageMaeR: null,
    averageMfeR: null,
  };
}

function breakdown(
  trades: readonly DevTrade[],
  group: (trade: DevTrade) => { key: string | null; label: string },
): readonly PerformanceBreakdownRow[] {
  const groups = new Map<string | null, DevTrade[]>();
  for (const trade of trades) {
    const { key } = group(trade);
    groups.set(key, [...(groups.get(key) ?? []), trade]);
  }
  return [...groups.values()]
    .map((rows) => {
      const { winners, losers, ...row } = counts(rows);
      return {
        ...group(rows[0] as DevTrade),
        ...row,
        netPnl: sum(rows.map(net)),
        profitFactor: profitFactor(winners, losers),
        averageRealizedR: realizedR(rows),
      };
    })
    .sort((a, b) => compare(b.netPnl, a.netPnl));
}

/**
 * DEVELOPMENT ONLY. Scripted journal; the statistics follow the backend's
 * rules on it: closed trades only, days of UTC+7, `to` not counted, MSG15
 * on `from`, and MSG29 on the paid reads for a plan without the feature.
 */
export function createDevelopmentJournal(
  session: () => Promise<Session | null>,
  now: () => number = Date.now,
): { journal: JournalService; performance: PerformanceService } {
  // A copy the manual trades of this session are written to.
  const trades = [...devJournalTrades(now())];
  const allowed = async () => {
    const entitlements = (await session())?.entitlements;
    return (
      entitlements !== undefined &&
      entitlements !== 'unknown' &&
      entitlements.features.includes('ADVANCED_PERFORMANCE')
    );
  };
  const gate = async () => {
    if (!(await allowed()))
      refuse(403, 'PLAN_FEATURE_NOT_INCLUDED', 'MSG29', ['PRO']);
  };
  const counted = (filter: PerformanceFilter) => {
    const to = filter.to ?? addDays(businessDay(now()), 1);
    if (filter.from && filter.from >= to)
      refuse(400, 'VALIDATION_FAILED', 'MSG01', [], { from: 'MSG15' });
    return trades.filter(
      (trade) =>
        trade.status === 'CLOSED' &&
        exitDay(trade) < to &&
        (!filter.from || exitDay(trade) >= filter.from) &&
        (!filter.market || trade.market === filter.market) &&
        (filter.source === 'ALL' || trade.source === filter.source) &&
        (!filter.pairId || trade.pairId === filter.pairId) &&
        (!filter.strategyId || trade.strategy?.id === filter.strategyId),
    );
  };
  // The review of each trade, kept in memory (UC-23); no image storage in
  // development, so a chart image cannot be uploaded here.
  const reviews = new Map<
    string,
    Pick<JournalEntry, 'setupDescription' | 'lessonsLearned' | 'mistakes'>
  >();
  const strategies = devJournalStrategies();
  const strategyOf = (id: string | null) => {
    if (id === null) return null;
    const found = strategies.find((strategy) => strategy.id === id);
    if (!found)
      refuse(400, 'VALIDATION_FAILED', 'MSG15', [], { strategyId: 'MSG15' });
    return found;
  };
  const owned = (id: string) =>
    trades.find((trade) => trade.id === id) ??
    refuse(404, 'RESOURCE_NOT_FOUND', 'MSG41');
  const entryOf = (trade: DevTrade): JournalEntry => {
    const { strategy, risk, ...row } = trade;
    const review = reviews.get(trade.id);
    return {
      trade: row,
      strategyId: strategy?.id ?? null,
      strategyName: strategy?.name ?? null,
      setupDescription: review?.setupDescription ?? null,
      lessonsLearned: review?.lessonsLearned ?? null,
      mistakes: review?.mistakes ?? null,
      chartImageUrl: null,
      chartImageKey: null,
      // Scripted: the fixture keeps the planned risk only (BR-70).
      learning:
        trade.source === 'SIMULATED'
          ? {
              plannedEntryPrice: null,
              entryDeviationR: null,
              entryLiquidity: null,
              riskAmount: risk,
              analysisTimeframe: null,
              setupScorePreset: null,
              setupScoreAtPlan: null,
              setupScoreAtFill: null,
              setupScoreDropWarned: null,
              indicators: null,
              maxAdversePrice: null,
              maxFavorablePrice: null,
              rMultiple: null,
              maeR: null,
              mfeR: null,
            }
          : null,
    };
  };
  const manual = (id: string, input: ManualTradeInput): DevTrade => {
    const missing = (
      ['pairId', 'entryPrice', 'quantity', 'entryTime'] as const
    ).filter((field) => !input[field]);
    if (missing.length)
      refuse(
        400,
        'VALIDATION_FAILED',
        'MSG01',
        [],
        Object.fromEntries(missing.map((field) => [field, 'MSG01'])),
      );
    const closed = input.exitPrice !== null && input.exitTime !== null;
    return {
      id,
      planId: null,
      pairId: input.pairId,
      market: input.market,
      direction: input.direction,
      source: 'MANUAL',
      status: closed ? 'CLOSED' : 'OPEN',
      leverage: input.leverage,
      entryPrice: input.entryPrice,
      quantity: input.quantity,
      entryTime: input.entryTime,
      entryFee: null,
      stopLoss: input.stopLoss,
      takeProfit: input.takeProfit,
      exitPrice: closed ? input.exitPrice : null,
      exitTime: closed ? input.exitTime : null,
      closeReason: closed ? 'MANUAL' : null,
      // The backend computes the P/L (BR-35); the fixture leaves it out.
      realizedPnl: null,
      feeAmount: closed ? (input.feeAmount ?? '0') : null,
      fundingFeeAmount: input.fundingFeeAmount,
      netPnl: null,
      provisional: false,
      strategy: strategyOf(input.strategyId),
      risk: '0',
    };
  };
  const simulatedRefused = (trade: DevTrade) => {
    if (trade.source === 'SIMULATED') refuse(409, 'CONFLICT', 'MSG43');
  };
  const symbol = (trade: DevTrade) =>
    devPairs(trade.market).find((pair) => pair.pairId === trade.pairId)
      ?.symbol ?? trade.pairId;

  return {
    journal: {
      list: async ({ status, pairId, market, page, pageSize }) => {
        const rows = trades.filter(
          (trade) =>
            (!status || trade.status === status) &&
            (!pairId || trade.pairId === pairId) &&
            (!market || trade.market === market),
        );
        const start = (page - 1) * pageSize;
        return {
          items: rows.slice(start, start + pageSize),
          page,
          pageSize,
          total: rows.length,
        };
      },
      get: async (id) => entryOf(owned(id)),
      record: async (input) => {
        const trade = manual(crypto.randomUUID(), input);
        trades.unshift(trade);
        reviews.set(trade.id, {
          setupDescription: input.setupDescription,
          lessonsLearned: input.lessonsLearned,
          mistakes: input.mistakes,
        });
        return entryOf(trade);
      },
      edit: async (id, input) => {
        const current = owned(id);
        simulatedRefused(current);
        const trade = manual(id, input);
        trades.splice(trades.indexOf(current), 1, trade);
        reviews.set(id, {
          setupDescription: input.setupDescription,
          lessonsLearned: input.lessonsLearned,
          mistakes: input.mistakes,
        });
        return entryOf(trade);
      },
      remove: async (id) => {
        const current = owned(id);
        simulatedRefused(current);
        trades.splice(trades.indexOf(current), 1);
        reviews.delete(id);
      },
      review: async (id, review) => {
        const current = owned(id);
        current.strategy = strategyOf(review.strategyId);
        if (review.chartImageKey !== null)
          refuse(400, 'MEDIA_INVALID', 'MSG32', [], {
            chartImagePublicId: 'MSG32',
          });
        reviews.set(id, {
          setupDescription: review.setupDescription,
          lessonsLearned: review.lessonsLearned,
          mistakes: review.mistakes,
        });
        return entryOf(current);
      },
      uploadChartImage: async () => refuse(503, 'SERVICE_UNAVAILABLE', 'MSG43'),
      strategies: async () => strategies,
    },
    performance: {
      summary: async (filter) => {
        const rows = counted(filter);
        const {
          trades: count,
          wins,
          losses,
          breakeven,
          winRate,
        } = counts(rows);
        return {
          from: filter.from ?? null,
          to: filter.to ?? addDays(businessDay(now()), 1),
          trades: count,
          wins,
          losses,
          breakeven,
          winRate,
          totalNetPnl: sum(rows.map(net)),
          provisionalTrades: rows.filter((trade) => trade.provisional).length,
          totalFees: sum(rows.map((trade) => trade.feeAmount ?? '0')),
          totalFunding: sum(rows.map((trade) => trade.fundingFeeAmount ?? '0')),
          advanced: (await allowed()) ? advanced(rows) : null,
        };
      },
      breakdown: async (kind, filter) => {
        await gate();
        const rows = counted(filter);
        if (kind === 'coin')
          return breakdown(rows, (trade) => ({
            key: trade.pairId,
            label: symbol(trade),
          }));
        if (kind === 'strategy')
          return breakdown(rows, (trade) => ({
            key: trade.strategy?.id ?? null,
            label: trade.strategy?.name ?? 'Unassigned',
          }));
        return breakdown(rows, (trade) => ({
          key: trade.market.toUpperCase(),
          label: trade.market.toUpperCase(),
        }));
      },
      equityCurve: async (filter) => {
        await gate();
        return curve(counted(filter));
      },
    },
  };
}
