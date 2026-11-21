import { Link, useNavigate } from 'react-router-dom';
import { Badge } from '../../../components/ui/Badge';
import { NumericText } from '../../../components/ui/NumericText';
import { Table, type Column } from '../../../components/ui/Table';
import { useCopy } from '../../../hooks/use-copy';
import { formatCopy } from '../../../i18n/copy';
import type {
  MarketPair,
  PlanTab,
  TradingPlanSummary,
} from '../../../types/domain';
import {
  formatInstantLocal,
  formatInstantUtc,
} from '../../../utils/instant-format';
import { pairLabel } from '../../../utils/pair-label';
import { DirectionText, PlanStatusBadge } from './PlanBadges';
import { planPrice, planRatio, shortPlanId } from './plan-format';

/**
 * SCR-16 table (SRS 3.5.2): pair, market, direction, entry, stop loss,
 * take profit, reward/risk, status and created time; the Executed tab adds
 * position status and P/L. The API names the pair by id only, so the pair
 * comes from the market lists by that id (FEQ-01); a pair no list has any
 * more shows a dash. The pair is the link to SCR-18, with the market and
 * the plan id under it; the position status sits under the plan status on
 * the Executed tab, so every column fits at 1440 px (T-140). A caller may
 * add columns before the status, drop the created time and turn rows into
 * cards on a phone (the SCR-08 plans, T-139); SCR-16 uses none of these.
 */
export function PlanTable({
  tab,
  rows,
  emptyMessage,
  pairOf,
  extra = [],
  showCreated = true,
  cards = false,
}: {
  tab: PlanTab;
  rows: readonly TradingPlanSummary[];
  emptyMessage: string;
  /** The row's pair from the market lists; undefined when not known. */
  pairOf: (row: TradingPlanSummary) => MarketPair | undefined;
  /** Columns shown after reward/risk, before the status. */
  extra?: readonly Column<TradingPlanSummary>[];
  showCreated?: boolean;
  cards?: boolean;
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
  const marketText = (row: TradingPlanSummary) =>
    row.market === 'futures'
      ? `${copy.market.futures}${row.leverage ? ` · ${row.leverage}x` : ''}`
      : copy.market.spot;
  // The plan id and the market sit under the pair (T-140): the table shares
  // its row with the journal and the coin rail, and ten columns pushed the
  // status out of view at 1440 px.
  const columns: Column<TradingPlanSummary>[] = [
    {
      id: 'pair',
      header: p.colPair,
      render: (row) => {
        const pair = pairOf(row);
        return (
          <span className="flex flex-col gap-0.5">
            <Link
              to={`/plans/${row.id}`}
              aria-label={formatCopy(p.openPlan, { id: shortPlanId(row.id) })}
              className="font-medium text-fg"
              onClick={(event) => event.stopPropagation()}
            >
              {pair ? pairLabel(pair.symbol) : none}
            </Link>
            <span className="text-[11px] text-muted-dim">
              <span>{marketText(row)}</span>
              {' · '}
              <span className="font-mono">#{shortPlanId(row.id)}</span>
            </span>
          </span>
        );
      },
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
    ...extra,
    {
      id: 'status',
      header: p.colStatus,
      // An INVALIDATED row says why in the Cancelled / Expired tab (BR-68);
      // on the Executed tab the position status sits under the plan status.
      render: (row) => (
        <span className="inline-flex flex-col items-start gap-1">
          <PlanStatusBadge status={row.status} />
          {row.invalidationReason && (
            <span className="max-w-40 text-[11px] whitespace-normal text-muted-dim">
              {p[`reason${row.invalidationReason}`]}
            </span>
          )}
          {tab === 'EXECUTED' &&
            (row.positionStatus ? (
              <Badge
                tone={row.positionStatus === 'OPEN' ? 'info' : 'neutral'}
                withDot
              >
                {p[`position${row.positionStatus}`]}
              </Badge>
            ) : (
              none
            ))}
        </span>
      ),
    },
  ];
  if (showCreated)
    columns.push({
      id: 'created',
      header: p.colCreated,
      render: (row) => (
        <time dateTime={row.createdAt} title={formatInstantUtc(row.createdAt)}>
          {formatInstantLocal(row.createdAt)}
        </time>
      ),
    });
  return (
    <Table
      caption={formatCopy(p.tableCaption, { tab: p[`tab${tab}`] })}
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      emptyMessage={emptyMessage}
      onRowClick={(row) => navigate(`/plans/${row.id}`)}
      dense
      cards={cards}
    />
  );
}
