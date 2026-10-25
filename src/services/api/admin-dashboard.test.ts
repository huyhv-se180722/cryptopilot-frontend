import { describe, expect, it, vi } from 'vitest';
import {
  createHttpAdminDashboardService,
  createPendingAdminDashboardService,
  decodeAdminDashboard,
  decodeAdminReport,
} from './admin-dashboard';
import { createHttpClient } from './http-client';

/** Bodies answered by backend develop @ 103d7cf. */
const DASHBOARD = {
  from: '2026-09-27',
  to: '2026-10-26',
  indicators: {
    activeSubscriptions: 6,
    activeUsers: 29,
    aiQuestions: 0,
    latestCandle: {
      FUTURES: '2026-10-25T22:29:59.999Z',
      SPOT: '2026-10-25T22:29:59.999Z',
    },
    newComments: 0,
    newPosts: 1,
    newUsers: 46,
    openReports: 0,
    paidOrders: 6,
    revenue: '6158000',
    revenueByPackage: {
      PREMIUM_YEARLY: '3980000',
      PRO_MONTHLY: '198000',
    },
    totalUsers: 53,
  },
};
const REPORT = {
  from: '2026-09-27',
  to: '2026-10-26',
  groupBy: 'WEEK',
  columns: ['newUsers', 'revenue', 'revenue:PRO_MONTHLY'],
  rows: [
    {
      period: '2026-09-21',
      coveredFrom: '2026-09-27',
      coveredTo: '2026-09-27',
      values: { newUsers: '0', revenue: '0', 'revenue:PRO_MONTHLY': '0' },
    },
  ],
};

describe('admin dashboard decoders (UC-40, UC-41)', () => {
  it('reads the indicators, by package and the latest candle per market', () => {
    expect(decodeAdminDashboard(DASHBOARD)).toEqual({
      from: '2026-09-27',
      to: '2026-10-26',
      totalUsers: 53,
      activeUsers: 29,
      activeSubscriptions: 6,
      openReports: 0,
      newUsers: 46,
      paidOrders: 6,
      revenue: '6158000',
      revenueByPackage: [
        { code: 'PREMIUM_YEARLY', revenue: '3980000' },
        { code: 'PRO_MONTHLY', revenue: '198000' },
      ],
      newPosts: 1,
      newComments: 0,
      aiQuestions: 0,
      latestCandle: {
        spot: '2026-10-25T22:29:59.999Z',
        futures: '2026-10-25T22:29:59.999Z',
      },
    });
  });

  it('reads an indicator no module answers as null', () => {
    const decoded = decodeAdminDashboard({
      ...DASHBOARD,
      indicators: { totalUsers: 3 },
    });
    expect(decoded).toMatchObject({
      totalUsers: 3,
      revenue: null,
      revenueByPackage: [],
      latestCandle: { spot: null, futures: null },
    });
    expect(() =>
      decodeAdminDashboard({ ...DASHBOARD, indicators: { totalUsers: -1 } }),
    ).toThrow();
  });

  it('reads every column of every row, and refuses a row without one', () => {
    expect(decodeAdminReport(REPORT).rows[0]?.values).toEqual({
      newUsers: '0',
      revenue: '0',
      'revenue:PRO_MONTHLY': '0',
    });
    expect(() =>
      decodeAdminReport({
        ...REPORT,
        rows: [{ ...REPORT.rows[0], values: { newUsers: '0' } }],
      }),
    ).toThrow();
  });
});

describe('HTTP admin dashboard adapter', () => {
  it('asks for the period and grouping, and reads the CSV as text', async () => {
    const urls: string[] = [];
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      const url = new URL(String(input));
      urls.push(url.pathname + url.search);
      if (url.pathname.endsWith('/export'))
        return new Response('period,newUsers\n2026-10-01,4', {
          status: 200,
          headers: { 'Content-Type': 'text/csv' },
        });
      return new Response(
        JSON.stringify(url.pathname.endsWith('/reports') ? REPORT : DASHBOARD),
        { status: 200 },
      );
    });
    const service = createHttpAdminDashboardService(
      createHttpClient({ baseUrl: 'https://api.example.test/api/v1', fetcher }),
    );
    await service.dashboard({});
    await service.report({ from: '2026-10-01', to: '2026-10-26' }, 'WEEK');
    await expect(
      service.exportReport({ from: '2026-10-01' }, 'MONTH'),
    ).resolves.toBe('period,newUsers\n2026-10-01,4');
    expect(urls).toEqual([
      '/api/v1/admin/dashboard',
      '/api/v1/admin/reports?from=2026-10-01&to=2026-10-26&groupBy=WEEK',
      '/api/v1/admin/reports/export?from=2026-10-01&groupBy=MONTH',
    ]);
  });

  it('is pending while no API is configured', async () => {
    await expect(
      createPendingAdminDashboardService().dashboard({}),
    ).rejects.toMatchObject({ code: 'NOT_CONFIGURED' });
  });
});
