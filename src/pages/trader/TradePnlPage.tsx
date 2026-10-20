import { useMemo, useState } from 'react';
import { PageHeader } from '../../components/layout/PageHeader';
import { StatCard } from '../../components/layout/StatCard';
import { NumericText } from '../../components/ui/NumericText';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { useCopy } from '../../hooks/use-copy';
import { formatCopy } from '../../i18n/copy';
import {
  MetricChart,
  type MetricLine,
} from '../../features/chart/components/MetricChart';
import { DemoTradingBanner } from '../../features/paper-trading/components/DemoTradingBanner';
import { PaperNav } from '../../features/paper-trading/components/PaperNav';
import { SpotPnlTable } from '../../features/paper-trading/components/SpotPnlTable';
import { PaperQueryState } from '../../features/paper-trading/components/paper-tables';
import { usePaperPush } from '../../features/paper-trading/hooks/use-paper-orders';
import {
  usePaperEquity,
  useSpotPnl,
} from '../../features/paper-trading/hooks/use-paper-pnl';
import { groupThousands, toFixedDecimal } from '../../utils/decimal-format';

const PERIODS = ['7', '30', '90'] as const;
type Period = (typeof PERIODS)[number];

/**
 * Demo PnL analysis (D-86, TR-13; after the exchange's Spot PnL analysis,
 * no Figma frame): the account's worth now with today's PnL, its worth at
 * the start of each UTC day over 7, 30 or 90 days, and the Spot coins at
 * their average cost with their unrealised PnL. Every number is the
 * backend's; virtual funds only.
 */
export function TradePnlPage() {
  usePaperPush();
  const copy = useCopy();
  const p = copy.paper;
  const [period, setPeriod] = useState<Period>('30');
  const days = Number(period);
  const pnl = useSpotPnl();
  const equity = usePaperEquity(days);
  const usdt = (value: string | null | undefined) =>
    value
      ? groupThousands(toFixedDecimal(value, 2)) + ' USDT'
      : copy.market.noValue;
  const today = equity.data?.todayPnl ?? null;
  const lines = useMemo<readonly MetricLine[]>(
    () => [
      {
        id: 'total',
        colorToken: '--cp-primary',
        scale: 'right',
        format: 'usdt',
        points: (equity.data?.history ?? []).map((point) => ({
          time: point.date + 'T00:00:00Z',
          value: point.totalEquity,
        })),
      },
    ],
    [equity.data],
  );

  return (
    <div className="mx-auto w-full max-w-7xl">
      <DemoTradingBanner />
      <PaperNav />
      <PageHeader title={p.pnlTitle} description={p.pnlSubtitle} />
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          label={p.pnlTotal}
          value={<NumericText value={usdt(equity.data?.totalEquity)} />}
          status={
            equity.data
              ? `${p.spotWallet} ${usdt(equity.data.spotEquity)} · ${p.futuresWallet} ${usdt(equity.data.futuresEquity)}`
              : undefined
          }
          accent="primary"
        />
        <StatCard
          label={p.pnlToday}
          value={
            today ? (
              <NumericText
                signed
                value={groupThousands(toFixedDecimal(today, 2))}
                suffix=" USDT"
              />
            ) : (
              copy.market.noValue
            )
          }
          status={
            equity.data?.todayPnlPercent
              ? `${equity.data.todayPnlPercent.startsWith('-') ? '' : '+'}${equity.data.todayPnlPercent}%`
              : equity.data && !today
                ? p.pnlTodayUnknown
                : undefined
          }
          accent={today?.startsWith('-') ? 'negative' : 'positive'}
        />
        <StatCard
          label={p.pnlSpotUnrealized}
          value={
            pnl.data ? (
              <NumericText
                signed
                value={groupThousands(
                  toFixedDecimal(pnl.data.totalUnrealizedPnl, 2),
                )}
                suffix=" USDT"
              />
            ) : (
              copy.market.noValue
            )
          }
          status={pnl.data ? usdt(pnl.data.totalValue) : undefined}
          accent={
            pnl.data?.totalUnrealizedPnl.startsWith('-')
              ? 'negative'
              : 'positive'
          }
        />
      </div>

      <section
        aria-labelledby="pnl-chart-title"
        className="mb-4 rounded-xl border border-line bg-surface p-4"
      >
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h2
            id="pnl-chart-title"
            className="mr-auto text-sm font-semibold text-fg"
          >
            {p.pnlChartTitle}
          </h2>
          <SegmentedControl
            label={p.pnlPeriod}
            value={period}
            onChange={setPeriod}
            options={PERIODS.map((value) => ({
              value,
              label: value + 'D',
            }))}
          />
        </div>
        <PaperQueryState query={equity}>
          {() =>
            equity.data && equity.data.history.length > 1 ? (
              <MetricChart
                label={formatCopy(p.pnlChartLabel, { days })}
                lines={lines}
                daily
              />
            ) : (
              <p className="py-8 text-center text-xs text-muted-dim">
                {p.pnlNoHistory}
              </p>
            )
          }
        </PaperQueryState>
      </section>

      <PaperQueryState query={pnl}>
        {() => pnl.data && <SpotPnlTable pnl={pnl.data} />}
      </PaperQueryState>
    </div>
  );
}
