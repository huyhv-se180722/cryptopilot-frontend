import { Link } from 'react-router-dom';
import { Layers, Pencil } from 'lucide-react';
import { Badge, type Tone } from '../../../components/ui/Badge';
import { NumericText } from '../../../components/ui/NumericText';
import { Table, type Column } from '../../../components/ui/Table';
import { useCopy } from '../../../hooks/use-copy';
import { formatCopy } from '../../../i18n/copy';
import type {
  AdminPair,
  ExchangeMarketInfo,
  ExchangeStatus,
} from '../../../types/domain';
import { pairLabel } from '../../../utils/pair-label';
import {
  formatInstantLocal,
  formatInstantUtc,
} from '../../../utils/instant-format';

const exchangeTone: Record<ExchangeStatus, Tone> = {
  TRADING: 'success',
  NOT_TRADING: 'warning',
  DELISTED: 'danger',
};

const actionClass =
  'inline-flex size-8 items-center justify-center rounded-lg text-muted-dim hover:bg-raised-hover hover:text-fg-2';

/**
 * SCR-37 (UC-45): every pair in display order with its status, each
 * market's switch beside what the exchange reports for it (NSF-01), the
 * leverage ceiling and bracket count of Futures (BR-26) and the last sync.
 * Edit opens the settings; Futures pairs link to their brackets (SCR-38).
 */
export function PairTable({
  pairs,
  onEdit,
}: {
  pairs: readonly AdminPair[];
  onEdit: (pair: AdminPair) => void;
}) {
  const copy = useCopy();
  const t = copy.adminPairs;
  const none = <span className="text-muted-x">{copy.market.noValue}</span>;
  const market = (on: boolean, info: ExchangeMarketInfo) => (
    <span className="flex flex-wrap items-center gap-1.5">
      <span className={on ? 'text-fg' : 'text-muted-x'}>
        {on ? t.on : t.off}
      </span>
      {info.exchangeStatus ? (
        info.exchangeStatus !== 'TRADING' || !on ? (
          <Badge tone={exchangeTone[info.exchangeStatus]}>
            {t[`exchange${info.exchangeStatus}`]}
          </Badge>
        ) : null
      ) : (
        <Badge tone="neutral">{t.exchangeNone}</Badge>
      )}
    </span>
  );
  const columns: Column<AdminPair>[] = [
    {
      id: 'pair',
      header: t.colPair,
      render: (pair) => (
        <span className="text-xs font-semibold text-fg">
          {pairLabel(pair.symbol)}
        </span>
      ),
    },
    {
      id: 'status',
      header: t.colStatus,
      render: (pair) => (
        <Badge tone={pair.status === 'ACTIVE' ? 'success' : 'neutral'}>
          {t[`status${pair.status}`]}
        </Badge>
      ),
    },
    {
      id: 'spot',
      header: t.colSpot,
      render: (pair) => market(pair.spotEnabled, pair.spot),
    },
    {
      id: 'futures',
      header: t.colFutures,
      render: (pair) => market(pair.futuresEnabled, pair.futures),
    },
    {
      id: 'leverage',
      header: t.colLeverage,
      numeric: true,
      render: (pair) =>
        pair.maxLeverage === null ? (
          none
        ) : (
          <NumericText
            value={formatCopy(t.leverageValue, { value: pair.maxLeverage })}
          />
        ),
    },
    {
      id: 'brackets',
      header: t.colBrackets,
      numeric: true,
      render: (pair) =>
        pair.futures.exchangeStatus ? (
          <Link
            to={`/admin/leverage-brackets?pair=${encodeURIComponent(pair.symbol)}`}
            className="inline-flex items-center gap-1 text-xs no-underline"
            aria-label={formatCopy(t.editBrackets, {
              pair: pairLabel(pair.symbol),
            })}
          >
            <NumericText value={String(pair.bracketCount)} />
            <Layers size={12} aria-hidden="true" />
          </Link>
        ) : (
          none
        ),
    },
    {
      id: 'order',
      header: t.colOrder,
      numeric: true,
      render: (pair) => <NumericText value={String(pair.displayOrder)} />,
    },
    {
      id: 'synced',
      header: t.colSynced,
      render: (pair) =>
        pair.lastSyncedAt ? (
          <time
            dateTime={pair.lastSyncedAt}
            title={formatInstantUtc(pair.lastSyncedAt)}
            className="text-xs whitespace-nowrap text-muted-dim"
          >
            {formatInstantLocal(pair.lastSyncedAt)}
          </time>
        ) : (
          none
        ),
    },
    {
      id: 'actions',
      header: t.colActions,
      render: (pair) => (
        <button
          type="button"
          className={actionClass}
          aria-label={formatCopy(t.edit, { pair: pairLabel(pair.symbol) })}
          title={formatCopy(t.edit, { pair: pairLabel(pair.symbol) })}
          onClick={() => onEdit(pair)}
        >
          <Pencil size={14} aria-hidden="true" />
        </button>
      ),
    },
  ];
  return (
    <Table
      caption={t.tableCaption}
      columns={columns}
      rows={pairs}
      rowKey={(pair) => pair.pairId}
      emptyMessage={t.empty}
    />
  );
}
