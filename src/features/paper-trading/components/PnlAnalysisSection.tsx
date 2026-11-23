import { useMemo, useState } from 'react';
import { StatCard } from '../../../components/layout/StatCard';
import { NumericText } from '../../../components/ui/NumericText';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { useCopy } from '../../../hooks/use-copy';
import { formatCopy } from '../../../i18n/copy';
import type { Decimal } from '../../../types/domain';
import { groupThousands, toFixedDecimal } from '../../../utils/decimal-format';
import {
  MetricChart,
  type MetricLine,
} from '../../chart/components/MetricChart';
import { usePnlAnalysis } from '../hooks/use-paper-pnl';
import { PaperQueryState } from './paper-tables';

type Market = 'ALL' | 'SPOT' | 'FUTURES';

/**
 * TR-28 on the demo PnL page (TR-F5, after the exchange's PnL analysis):
 * of both wallets or one, the PnL of each UTC day of the period as bars
 * with its running total as a line, the deepest fall of the account's
 * worth, and the record of the trades closed in it (wins, losses, win
 * rate, average win and loss, profit factor). Transfers between the
 * wallets are not PnL. Every number is the backend's.
 */
export function PnlAnalysisSection({ days }: { days: 7 | 30 | 90 }) {
  const copy = useCopy();
  const p = copy.paper;
  const [market, setMarket] = useState<Market>('ALL');
  const analysis = usePnlAnalysis(market === 'ALL' ? null : market, days);
  const data = analysis.data;
  const usdt = (value: Decimal | null | undefined, signed = true) =>
    value ? (
      <NumericText
        signed={signed}
        value={groupThousands(toFixedDecimal(value, 2))}
        suffix=" USDT"
      />
    ) : (
      copy.market.noValue
    );
  const lines = useMemo<readonly MetricLine[]>(
    () => [
      {
        id: 'daily',
        colorToken: '--cp-positive',
        scale: 'right',
        format: 'usdt',
        kind: 'histogram',
        points: (data?.daily ?? []).map((day) => ({
          time: day.date + 'T00:00:00Z',
          value: day.pnl,
        })),
      },
      {
        id: 'cumulative',
        colorToken: '--cp-primary',
        scale: 'right',
        format: 'usdt',
        points: (data?.daily ?? []).map((day) => ({
          time: day.date + 'T00:00:00Z',
          value: day.cumulativePnl,
        })),
      },
    ],
    [data],
  );
  const trades = data?.trades;

  return (
    <section
      aria-labelledby="pnl-analysis-title"
      className="mb-4 rounded-xl border border-line bg-surface p-4"
    >
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h2
          id="pnl-analysis-title"
          className="mr-auto text-sm font-semibold text-fg"
        >
          {p.analysisTitle}
        </h2>
        <SegmentedControl
          label={p.analysisMarket}
          value={market}
          onChange={setMarket}
          options={[
            { value: 'ALL', label: p.analysisAll },
            { value: 'SPOT', label: p.spotWallet },
            { value: 'FUTURES', label: p.futuresWallet },
          ]}
        />
      </div>
      <PaperQueryState query={analysis}>
        {() =>
          data && trades ? (
            <>
              <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard
                  label={formatCopy(p.analysisCumulative, { days })}
                  value={usdt(data.cumulativePnl)}
                  accent={
                    data.cumulativePnl.startsWith('-') ? 'negative' : 'positive'
                  }
                />
                <StatCard
                  label={p.analysisDrawdown}
                  value={usdt(data.maxDrawdown)}
                  status={
                    data.maxDrawdownPercent
                      ? data.maxDrawdownPercent + '%'
                      : undefined
                  }
                  accent="warning"
                />
                <StatCard
                  label={p.analysisWinRate}
                  value={
                    trades.winRate ? (
                      <NumericText value={trades.winRate} suffix="%" />
                    ) : (
                      copy.market.noValue
                    )
                  }
                  status={formatCopy(p.analysisRecord, {
                    closed: trades.closed,
                    wins: trades.wins,
                    losses: trades.losses,
                  })}
                  accent="primary"
                />
                <StatCard
                  label={p.analysisProfitFactor}
                  value={
                    trades.profitFactor ? (
                      <NumericText value={trades.profitFactor} />
                    ) : (
                      copy.market.noValue
                    )
                  }
                  status={
                    <>
                      {p.analysisAverageWin} {usdt(trades.averageWin)} ·{' '}
                      {p.analysisAverageLoss} {usdt(trades.averageLoss)}
                    </>
                  }
                  accent="accent"
                />
              </div>
              {data.daily.length > 0 ? (
                <MetricChart
                  label={formatCopy(p.analysisChartLabel, { days })}
                  lines={lines}
                  daily
                  lastValues={false}
                />
              ) : (
                <p className="py-8 text-center text-xs text-muted-dim">
                  {p.pnlNoHistory}
                </p>
              )}
              <p className="mt-2 text-xs text-muted-dim">
                {p.analysisNote}
                {!data.complete && ' ' + p.analysisIncomplete}
              </p>
            </>
          ) : null
        }
      </PaperQueryState>
    </section>
  );
}
