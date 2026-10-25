import type { AdminDashboardService } from '../services/api/contracts';
import { ServiceError } from '../services/api/errors';
import type { AdminPeriod, AdminReport, ReportGrouping } from '../types/domain';

/**
 * DEVELOPMENT ONLY. Scripted SCR-33 figures: the indicators and a report of
 * the period, not computed from any other fixture. A period that starts
 * after it ends is refused like the backend (MSG15 on `from`).
 */
const DAY_MS = 86_400_000;
const iso = (time: number) => new Date(time).toISOString().slice(0, 10);

function bounds(period: AdminPeriod, now: number) {
  const to = period.to ?? iso(now);
  const from = period.from ?? iso(Date.parse(to) - 29 * DAY_MS);
  if (from > to)
    throw new ServiceError('Development refusal.', 'HTTP_ERROR', 400, {
      status: 400,
      code: 'VALIDATION_FAILED',
      messageCode: 'MSG01',
      messageArgs: [],
      fieldErrors: { from: 'MSG15' },
    });
  return { from, to };
}

const COLUMNS = [
  'newUsers',
  'paidOrders',
  'revenue',
  'revenue:PRO_MONTHLY',
  'revenue:PREMIUM_YEARLY',
  'newPosts',
  'newComments',
  'aiQuestions',
];

function report(
  period: AdminPeriod,
  groupBy: ReportGrouping,
  now: number,
): AdminReport {
  const { from, to } = bounds(period, now);
  const step = groupBy === 'DAY' ? 1 : groupBy === 'WEEK' ? 7 : 30;
  const rows: AdminReport['rows'][number][] = [];
  for (
    let start = Date.parse(from), n = 0;
    start <= Date.parse(to);
    start += step * DAY_MS, n++
  ) {
    const end = Math.min(start + (step - 1) * DAY_MS, Date.parse(to));
    const paid = n % 3;
    rows.push({
      period: iso(start),
      coveredFrom: iso(start),
      coveredTo: iso(end),
      values: {
        newUsers: String((n * 7) % 11),
        paidOrders: String(paid),
        revenue: String(paid * 199000),
        'revenue:PRO_MONTHLY': String(paid * 199000),
        'revenue:PREMIUM_YEARLY': '0',
        newPosts: String(n % 4),
        newComments: String((n * 3) % 5),
        aiQuestions: '0',
      },
    });
  }
  return { from, to, groupBy, columns: COLUMNS, rows };
}

export function createDevelopmentAdminDashboard(
  now: () => number = Date.now,
): AdminDashboardService {
  const pause = () => new Promise((resolve) => setTimeout(resolve, 120));
  return {
    async dashboard(period) {
      await pause();
      const { from, to } = bounds(period, now());
      const candle = new Date(
        Math.floor(now() / 60_000) * 60_000 - 1,
      ).toISOString();
      return {
        from,
        to,
        totalUsers: 45,
        activeUsers: 29,
        activeSubscriptions: 6,
        openReports: 3,
        newUsers: 12,
        paidOrders: 6,
        revenue: '6158000',
        revenueByPackage: [
          { code: 'PREMIUM_YEARLY', revenue: '3980000' },
          { code: 'PRO_MONTHLY', revenue: '198000' },
          { code: 'PRO_YEARLY', revenue: '1980000' },
        ],
        newPosts: 9,
        newComments: 21,
        aiQuestions: 0,
        latestCandle: { spot: candle, futures: candle },
      };
    },
    async report(period, groupBy) {
      await pause();
      return report(period, groupBy, now());
    },
    async exportReport(period, groupBy) {
      await pause();
      const data = report(period, groupBy, now());
      return [
        ['period', 'coveredFrom', 'coveredTo', ...data.columns].join(','),
        ...data.rows.map((row) =>
          [
            row.period,
            row.coveredFrom,
            row.coveredTo,
            ...data.columns.map((column) => row.values[column]),
          ].join(','),
        ),
      ].join('\n');
    },
  };
}
