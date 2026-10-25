import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Download } from 'lucide-react';
import { ErrorState } from '../../components/feedback/States';
import { PageHeader } from '../../components/layout/PageHeader';
import { StatCard } from '../../components/layout/StatCard';
import { Button } from '../../components/ui/Button';
import { NumericText } from '../../components/ui/NumericText';
import { SectionTitle } from '../../components/ui/SectionTitle';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { Skeleton } from '../../components/ui/Skeleton';
import { Table, type Column } from '../../components/ui/Table';
import {
  businessDay,
  columnLabel,
  isMoneyColumn,
  vnd,
} from '../../features/admin/components/dashboard-format';
import {
  useAdminDashboard,
  useAdminReport,
  useExportReport,
} from '../../features/admin/hooks/use-admin-dashboard';
import { useCopy } from '../../hooks/use-copy';
import { useToast } from '../../hooks/use-toast';
import { formatCopy } from '../../i18n/copy';
import { errorText } from '../../i18n/messages';
import type {
  AdminDashboard,
  AdminPeriod,
  AdminReport,
  ReportGrouping,
} from '../../types/domain';
import {
  formatInstantLocal,
  formatInstantUtc,
} from '../../utils/instant-format';

const PERIODS = ['7', '30', '90'] as const;
type PeriodDays = (typeof PERIODS)[number];

/**
 * SCR-33 Admin Overview (SRS 3.11.1, UC-40, UC-41): the indicators of now
 * (users, active in 7 days, subscriptions, open reports) and of a period
 * of 7, 30 or 90 business days (UTC+7): new users, paid orders, revenue in
 * VND by package, posts, comments, AI questions and the newest candle per
 * market; then the management report by day, week or month with its CSV
 * export. Layout from the Figma admin overview, without its invented
 * service-health cards.
 */
export function AdminOverviewPage() {
  const copy = useCopy();
  const t = copy.adminOverview;
  const [days, setDays] = useState<PeriodDays>('30');
  const [groupBy, setGroupBy] = useState<ReportGrouping>('DAY');
  const period: AdminPeriod = {
    from: businessDay(Number(days) - 1),
    to: businessDay(0),
  };
  const dashboard = useAdminDashboard(period);
  const report = useAdminReport(period, groupBy);

  return (
    <div className="w-full">
      <PageHeader
        size="sm"
        title={t.title}
        description={
          dashboard.data
            ? formatCopy(t.subtitle, {
                from: dashboard.data.from,
                to: dashboard.data.to,
              })
            : t.subtitleLoading
        }
        actions={
          <SegmentedControl<PeriodDays>
            label={t.periodLabel}
            value={days}
            onChange={setDays}
            options={PERIODS.map((value) => ({
              value,
              label: formatCopy(t.periodDays, { n: value }),
            }))}
          />
        }
      />
      {dashboard.isPending ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((k) => (
            <Skeleton key={k} className="h-20 w-full" />
          ))}
        </div>
      ) : dashboard.isError ? (
        <ErrorState
          message={errorText(copy, dashboard.error)}
          onRetry={() => void dashboard.refetch()}
        />
      ) : (
        <Indicators data={dashboard.data} />
      )}
      <section aria-labelledby="report-title" className="mt-6">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <h2 id="report-title" className="m-0">
            <SectionTitle>{t.reportTitle}</SectionTitle>
          </h2>
          <div className="flex flex-wrap items-end gap-2">
            <SegmentedControl<ReportGrouping>
              label={t.groupLabel}
              value={groupBy}
              onChange={setGroupBy}
              options={(['DAY', 'WEEK', 'MONTH'] as const).map((value) => ({
                value,
                label: t[`group${value}`],
              }))}
            />
            <ExportButton period={period} groupBy={groupBy} />
          </div>
        </div>
        {report.isPending ? (
          <Skeleton className="h-48 w-full" />
        ) : report.isError ? (
          <ErrorState
            message={errorText(copy, report.error)}
            onRetry={() => void report.refetch()}
          />
        ) : (
          <ReportTable report={report.data} />
        )}
      </section>
    </div>
  );
}

function count(value: number | null, none: string) {
  return value === null ? none : <NumericText value={String(value)} />;
}

function Indicators({ data }: { data: AdminDashboard }) {
  const copy = useCopy();
  const t = copy.adminOverview;
  const none = copy.market.noValue;
  const candle = (value: string | null) =>
    value ? (
      <time dateTime={value} title={formatInstantUtc(value)}>
        {formatInstantLocal(value)}
      </time>
    ) : (
      t.noCandle
    );
  return (
    <>
      <p className="mb-2 text-[11px] text-muted-dim">{t.nowCaption}</p>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t.totalUsers} value={count(data.totalUsers, none)} />
        <StatCard
          label={t.activeUsers}
          value={count(data.activeUsers, none)}
          status={t.activeUsersHint}
          accent="positive"
        />
        <StatCard
          label={t.activeSubscriptions}
          value={count(data.activeSubscriptions, none)}
          accent="accent"
        />
        <StatCard
          label={t.openReports}
          value={count(data.openReports, none)}
          accent="warning"
          status={
            data.openReports ? (
              <Link to="/admin/reports">{t.reviewReports}</Link>
            ) : undefined
          }
        />
      </div>
      <p className="mb-2 text-[11px] text-muted-dim">{t.periodCaption}</p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t.newUsers} value={count(data.newUsers, none)} />
        <StatCard
          label={t.paidOrders}
          value={count(data.paidOrders, none)}
          accent="accent"
        />
        <StatCard
          label={t.revenue}
          value={
            data.revenue === null ? (
              none
            ) : (
              <NumericText value={vnd(data.revenue)} />
            )
          }
          status="VND"
          accent="positive"
        />
        <StatCard
          label={t.aiQuestions}
          value={count(data.aiQuestions, none)}
          accent="purple"
        />
        <StatCard label={t.newPosts} value={count(data.newPosts, none)} />
        <StatCard label={t.newComments} value={count(data.newComments, none)} />
        <StatCard
          label={t.latestSpot}
          value={
            <span className="text-sm">{candle(data.latestCandle.spot)}</span>
          }
        />
        <StatCard
          label={t.latestFutures}
          value={
            <span className="text-sm">{candle(data.latestCandle.futures)}</span>
          }
        />
      </div>
      {data.revenueByPackage.length > 0 && (
        <div className="mt-4 rounded-xl border border-line bg-surface p-4">
          <SectionTitle>{t.byPackage}</SectionTitle>
          <dl className="grid gap-2 text-xs sm:grid-cols-3">
            {data.revenueByPackage.map((row) => (
              <div
                key={row.code}
                className="flex justify-between gap-3 border-b border-line pb-1.5"
              >
                <dt className="font-mono text-[11px] text-muted-dim">
                  {row.code}
                </dt>
                <dd className="m-0">
                  <NumericText value={vnd(row.revenue)} suffix=" VND" />
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </>
  );
}

type ReportRow = AdminReport['rows'][number];

function ReportTable({ report }: { report: AdminReport }) {
  const copy = useCopy();
  const t = copy.adminOverview;
  const columns: Column<ReportRow>[] = [
    {
      id: 'period',
      header: t.colPeriod,
      render: (row) => (
        <span className="text-xs whitespace-nowrap text-fg">
          {row.period}
          {/* A week or month cut by the period counts fewer days. */}
          {report.groupBy !== 'DAY' && (
            <span className="block text-[10px] text-muted-dim">
              {formatCopy(t.covered, {
                from: row.coveredFrom,
                to: row.coveredTo,
              })}
            </span>
          )}
        </span>
      ),
    },
    ...report.columns.map((column): Column<ReportRow> => ({
      id: column,
      header: columnLabel(copy, column),
      numeric: true,
      render: (row) => {
        const value = row.values[column] ?? '0';
        return (
          <NumericText value={isMoneyColumn(column) ? vnd(value) : value} />
        );
      },
    })),
  ];
  return (
    <Table
      caption={t.reportCaption}
      columns={columns}
      rows={report.rows}
      rowKey={(row) => row.period}
      emptyMessage={t.reportEmpty}
    />
  );
}

function ExportButton({
  period,
  groupBy,
}: {
  period: AdminPeriod;
  groupBy: ReportGrouping;
}) {
  const copy = useCopy();
  const t = copy.adminOverview;
  const { show } = useToast();
  const exporting = useExportReport();

  async function save() {
    const result = await exporting.run(period, groupBy);
    if (result.status === 'error') {
      show({ tone: 'error', message: errorText(copy, result.error) });
      return;
    }
    if (result.status !== 'success') return;
    // The server names the file the same way in its Content-Disposition.
    const name = `cryptopilot-report-${period.from}-${period.to}-${groupBy.toLowerCase()}.csv`;
    const url = URL.createObjectURL(
      new Blob([result.data], { type: 'text/csv;charset=utf-8' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Button
      variant="secondary"
      size="sm"
      disabled={exporting.pending}
      onClick={() => void save()}
    >
      <Download size={13} aria-hidden="true" />
      {t.exportCsv}
    </Button>
  );
}
