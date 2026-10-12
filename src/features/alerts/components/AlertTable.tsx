import { Link } from 'react-router-dom';
import { MoreHorizontal, Pause, Pencil, Play, Trash2 } from 'lucide-react';
import { Badge, type Tone } from '../../../components/ui/Badge';
import { Menu, type MenuItem } from '../../../components/ui/Menu';
import { Table, type Column } from '../../../components/ui/Table';
import { useCopy } from '../../../hooks/use-copy';
import { formatCopy } from '../../../i18n/copy';
import type { Alert, AlertStatus } from '../../../types/domain';
import {
  formatInstantLocal,
  formatInstantUtc,
} from '../../../utils/instant-format';
import { pairLabel } from '../../../utils/pair-label';
import { conditionText } from './alert-format';

const STATUS_TONE: Record<AlertStatus, Tone> = {
  ACTIVE: 'success',
  PAUSED: 'warning',
  TRIGGERED: 'info',
  EXPIRED: 'neutral',
};

export function AlertStatusBadge({ status }: { status: AlertStatus }) {
  const a = useCopy().alerts;
  return (
    <Badge tone={STATUS_TONE[status]} withDot>
      {a[`status${status}`]}
    </Badge>
  );
}

function When({ at, fallback }: { at: string | null; fallback: string }) {
  if (!at) return <span className="text-muted-x">{fallback}</span>;
  return (
    <time dateTime={at} title={formatInstantUtc(at)}>
      {formatInstantLocal(at)}
    </time>
  );
}

export type AlertRowAction = 'edit' | 'pause' | 'resume' | 'delete';

/**
 * SCR-13 table (SRS 3.4.3): pair, market, type, condition, status, trigger
 * count, last triggered time and expiry, with Edit, Pause / Resume and
 * Delete per row. The pair opens its analysis screen.
 */
export function AlertTable({
  rows,
  emptyMessage,
  disabled,
  onAction,
}: {
  rows: readonly Alert[];
  emptyMessage: string;
  disabled: boolean;
  onAction: (action: AlertRowAction, alert: Alert) => void;
}) {
  const copy = useCopy();
  const a = copy.alerts;
  const columns: Column<Alert>[] = [
    {
      id: 'pair',
      header: a.colPair,
      render: (row) => (
        <Link
          to={`/markets/${row.market}/${row.symbol}`}
          className="font-medium"
        >
          {pairLabel(row.symbol)}
        </Link>
      ),
    },
    {
      id: 'market',
      header: a.colMarket,
      render: (row) =>
        row.market === 'futures' ? copy.market.futures : copy.market.spot,
    },
    {
      id: 'type',
      header: a.colType,
      render: (row) => a[`type${row.type}`],
    },
    {
      id: 'condition',
      header: a.colCondition,
      render: (row) => (
        <span className="font-mono text-xs">{conditionText(copy, row)}</span>
      ),
    },
    {
      id: 'status',
      header: a.colStatus,
      render: (row) => <AlertStatusBadge status={row.status} />,
    },
    {
      id: 'triggers',
      header: a.colTriggers,
      numeric: true,
      render: (row) => (
        <span className="font-mono tabular-nums">{row.triggerCount}</span>
      ),
    },
    {
      id: 'last',
      header: a.colLastTriggered,
      render: (row) => <When at={row.lastTriggeredAt} fallback={a.never} />,
    },
    {
      id: 'expiry',
      header: a.colExpiry,
      render: (row) => <When at={row.expiresAt} fallback={a.noExpiry} />,
    },
    {
      id: 'actions',
      header: a.colActions,
      render: (row) => {
        const items: MenuItem[] = [
          {
            id: 'edit',
            label: a.edit,
            icon: <Pencil size={13} aria-hidden="true" />,
            onSelect: () => onAction('edit', row),
          },
          ...(row.status === 'ACTIVE'
            ? [
                {
                  id: 'pause',
                  label: a.pause,
                  icon: <Pause size={13} aria-hidden="true" />,
                  onSelect: () => onAction('pause', row),
                },
              ]
            : row.status === 'PAUSED'
              ? [
                  {
                    id: 'resume',
                    label: a.resume,
                    icon: <Play size={13} aria-hidden="true" />,
                    onSelect: () => onAction('resume', row),
                  },
                ]
              : []),
          {
            id: 'delete',
            label: a.delete,
            tone: 'danger',
            icon: <Trash2 size={13} aria-hidden="true" />,
            onSelect: () => onAction('delete', row),
          },
        ];
        return disabled ? (
          <MoreHorizontal size={14} aria-hidden="true" className="opacity-40" />
        ) : (
          <Menu
            label={formatCopy(a.actionsFor, { pair: pairLabel(row.symbol) })}
            trigger={
              <span className="inline-flex size-7 items-center justify-center rounded-lg text-muted-dim hover:bg-raised hover:text-fg-2 pointer-coarse:size-9">
                <MoreHorizontal size={14} aria-hidden="true" />
              </span>
            }
            items={items}
          />
        );
      },
    },
  ];
  return (
    <Table
      caption={a.tableCaption}
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      emptyMessage={emptyMessage}
    />
  );
}
