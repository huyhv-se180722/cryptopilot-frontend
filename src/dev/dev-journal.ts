import type {
  JournalService,
  PerformanceService,
} from '../services/api/contracts';
import { ServiceError } from '../services/api/errors';
import type {
  EquityPoint,
  PerformanceAdvanced,
  PerformanceBreakdownRow,
  PerformanceFilter,
  Session,
} from '../types/domain';
import { addDays, businessDay } from '../utils/business-day';
import { add, compare, divide, subtract } from '../utils/decimal-math';
import { devJournalTrades, type DevTrade } from './fixtures/journal';
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
  const trades = devJournalTrades(now());
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
