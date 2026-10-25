import type {
  AdminDashboard,
  AdminPeriod,
  AdminReport,
  ReportGrouping,
} from '../../types/domain';
import type { AdminDashboardService } from './contracts';
import {
  decimal,
  integer,
  list,
  nullableInstant,
  oneOf,
  record,
  text,
} from './decode';
import { integrationPending } from './errors';
import type { HttpClient } from './http-client';

const GROUPINGS: readonly ReportGrouping[] = ['DAY', 'WEEK', 'MONTH'];
const DAY = /^\d{4}-\d{2}-\d{2}$/;

function day(value: unknown, name: string): string {
  const raw = text(value, name);
  if (!DAY.test(raw)) throw new Error(name + ' must be a date');
  return raw;
}

const count = (value: unknown, name: string) => {
  if (value === undefined || value === null) return null;
  const n = integer(value, name);
  if (n < 0) throw new Error(name + ' must not be negative');
  return n;
};

/**
 * `GET /admin/dashboard` (UC-40), checked against backend develop @
 * 103d7cf: `DashboardResponse` whose `indicators` are merged from each
 * module; counts are numbers, amounts decimal texts, `latestCandle` the
 * close time per market. An indicator a module does not answer is null.
 */
export function decodeAdminDashboard(body: unknown): AdminDashboard {
  const value = record(body);
  const indicators = record(value.indicators, 'indicators');
  const byPackage =
    indicators.revenueByPackage === undefined
      ? {}
      : record(indicators.revenueByPackage, 'revenueByPackage');
  const candles =
    indicators.latestCandle === undefined
      ? {}
      : record(indicators.latestCandle, 'latestCandle');
  return {
    from: day(value.from, 'from'),
    to: day(value.to, 'to'),
    totalUsers: count(indicators.totalUsers, 'totalUsers'),
    activeUsers: count(indicators.activeUsers, 'activeUsers'),
    activeSubscriptions: count(
      indicators.activeSubscriptions,
      'activeSubscriptions',
    ),
    openReports: count(indicators.openReports, 'openReports'),
    newUsers: count(indicators.newUsers, 'newUsers'),
    paidOrders: count(indicators.paidOrders, 'paidOrders'),
    revenue:
      indicators.revenue === undefined
        ? null
        : decimal(indicators.revenue, 'revenue'),
    revenueByPackage: Object.entries(byPackage).map(([code, revenue]) => ({
      code,
      revenue: decimal(revenue, 'revenueByPackage.' + code),
    })),
    newPosts: count(indicators.newPosts, 'newPosts'),
    newComments: count(indicators.newComments, 'newComments'),
    aiQuestions: count(indicators.aiQuestions, 'aiQuestions'),
    latestCandle: {
      spot: nullableInstant(candles.SPOT, 'latestCandle.SPOT'),
      futures: nullableInstant(candles.FUTURES, 'latestCandle.FUTURES'),
    },
  };
}

/** `GET /admin/reports` (UC-41): `ReportResponse` with its rows. */
export function decodeAdminReport(body: unknown): AdminReport {
  const value = record(body);
  const columns = list(value.columns, 'columns').map((column, i) =>
    text(column, 'columns[' + i + ']'),
  );
  return {
    from: day(value.from, 'from'),
    to: day(value.to, 'to'),
    groupBy: oneOf(GROUPINGS, value.groupBy, 'groupBy'),
    columns,
    rows: list(value.rows, 'rows').map((item, i) => {
      const row = record(item, 'rows[' + i + ']');
      const values = record(row.values, 'rows.values');
      return {
        period: day(row.period, 'rows.period'),
        coveredFrom: day(row.coveredFrom, 'rows.coveredFrom'),
        coveredTo: day(row.coveredTo, 'rows.coveredTo'),
        values: Object.fromEntries(
          columns.map((column) => [
            column,
            decimal(values[column], 'rows.values.' + column),
          ]),
        ),
      };
    }),
  };
}

const query = (period: AdminPeriod, groupBy?: ReportGrouping) => {
  const params = new URLSearchParams();
  if (period.from) params.set('from', period.from);
  if (period.to) params.set('to', period.to);
  if (groupBy) params.set('groupBy', groupBy);
  const search = params.toString();
  return search ? '?' + search : '';
};

/** Used while no API base URL is configured. */
export function createPendingAdminDashboardService(): AdminDashboardService {
  return {
    dashboard: async () => integrationPending(),
    report: async () => integrationPending(),
    exportReport: async () => integrationPending(),
  };
}

/** `/admin/dashboard`, `/admin/reports` and its CSV export (SCR-33), Admin only. */
export function createHttpAdminDashboardService(
  http: HttpClient,
): AdminDashboardService {
  return {
    dashboard: (period, signal) =>
      http.request({
        path: 'admin/dashboard' + query(period),
        decode: decodeAdminDashboard,
        ...(signal ? { signal } : {}),
      }),
    report: (period, groupBy, signal) =>
      http.request({
        path: 'admin/reports' + query(period, groupBy),
        decode: decodeAdminReport,
        ...(signal ? { signal } : {}),
      }),
    exportReport: (period, groupBy) =>
      http.request({
        path: 'admin/reports/export' + query(period, groupBy),
        headers: { Accept: 'text/csv' },
        responseType: 'text',
        decode: (body) => {
          if (typeof body !== 'string') throw new Error('CSV must be text');
          return body;
        },
      }),
  };
}
