import { Link, useNavigate } from 'react-router-dom';
import { NumericText } from '../../../components/ui/NumericText';
import { Table, type Column } from '../../../components/ui/Table';
import { useCopy } from '../../../hooks/use-copy';
import { formatCopy } from '../../../i18n/copy';
import type { PlanTab, TradingPlanSummary } from '../../../types/domain';
import {
  formatInstantLocal,
  formatInstantUtc,
} from '../../../utils/instant-format';
import { DirectionText, PlanStatusBadge } from './PlanBadges';
import { planPrice, planRatio, shortPlanId } from './plan-format';

/**
 * SCR-16 table (SRS 3.5.2): pair, market, direction, entry, stop loss,
 * take profit, reward/risk, status and created time; the Executed tab adds
 * position status and P/L. The API names the pair by id only (FEQ-01), so
 * the plan id is the link to SCR-18 and the pair cell shows a dash; the
 * position columns wait for simulated execution (M-10).
 */
export function PlanTable({
  tab,
  rows,
  emptyMessage,
}: {
  tab: PlanTab;
  rows: readonly TradingPlanSummary[];
  emptyMessage: string;
}) {
  const copy = useCopy();
  const p = copy.plan;
  const navigate = useNavigate();
  const none = (
    <span className="text-muted-x" title={p.pairUnknown}>
      {copy.market.noValue}
    </span>
  );
  const price = (value: string) => <NumericText value={planPrice(value)} />;
  const columns: Column<TradingPlanSummary>[] = [
    {
      id: 'plan',
      header: '#',
      render: (row) => (
        <Link
          to={`/plans/${row.id}`}
          aria-label={formatCopy(p.openPlan, { id: shortPlanId(row.id) })}
          className="font-mono text-[11px] font-medium"
          onClick={(event) => event.stopPropagation()}
        >
          {shortPlanId(row.id)}
        </Link>
      ),
    },
    { id: 'pair', header: p.colPair, render: () => none },
    {
      id: 'market',
      header: p.colMarket,
      render: (row) =>
        row.market === 'futures'
          ? `${copy.market.futures}${row.leverage ? ` · ${row.leverage}x` : ''}`
          : copy.market.spot,
    },
    {
      id: 'direction',
      header: p.colDirection,
      render: (row) => <DirectionText direction={row.direction} />,
    },
    {
      id: 'entry',
      header: p.colEntry,
      numeric: true,
      render: (row) => price(row.entryPrice),
    },
    {
      id: 'stop',
      header: p.colStopLoss,
      numeric: true,
      render: (row) => price(row.stopLoss),
    },
    {
      id: 'take',
      header: p.colTakeProfit,
      numeric: true,
      render: (row) => price(row.takeProfit),
    },
    {
      id: 'rr',
      header: p.colRiskReward,
      numeric: true,
      render: (row) => <NumericText value={planRatio(row.riskRewardRatio)} />,
    },
    {
      id: 'status',
      header: p.colStatus,
      render: (row) => <PlanStatusBadge status={row.status} />,
    },
    ...(tab === 'EXECUTED'
      ? [
          {
            id: 'position',
            header: p.colPosition,
            render: () => none,
          },
          {
            id: 'pnl',
            header: p.colPnl,
            numeric: true,
            render: () => none,
          },
        ]
      : []),
    {
      id: 'created',
      header: p.colCreated,
      render: (row) => (
        <time dateTime={row.createdAt} title={formatInstantUtc(row.createdAt)}>
          {formatInstantLocal(row.createdAt)}
        </time>
      ),
    },
  ];
  return (
    <Table
      caption={formatCopy(p.tableCaption, { tab: p[`tab${tab}`] })}
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      emptyMessage={emptyMessage}
      onRowClick={(row) => navigate(`/plans/${row.id}`)}
    />
  );
}
