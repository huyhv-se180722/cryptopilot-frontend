import { useState, type DragEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDown,
  ArrowUp,
  Bell,
  GripVertical,
  MoreHorizontal,
  Pencil,
  Trash2,
} from 'lucide-react';
import { Badge } from '../../../components/ui/Badge';
import { Menu, type MenuItem } from '../../../components/ui/Menu';
import { NumericText } from '../../../components/ui/NumericText';
import { useCopy } from '../../../hooks/use-copy';
import { formatCopy } from '../../../i18n/copy';
import type {
  MarketTicker,
  SetupScore,
  WatchlistItem,
} from '../../../types/domain';
import { classNames } from '../../../utils/class-names';
import { formatPrice, toFixedDecimal } from '../../../utils/decimal-format';
import { pairLabel } from '../../../utils/pair-label';
import { groupRows, moveWithinGroup } from './watchlist-order';

export interface WatchlistPrices {
  spot: ReadonlyMap<string, MarketTicker>;
  futures: ReadonlyMap<string, MarketTicker>;
  /** Tick size per market and symbol (CR-02); null until known. */
  tick: (market: 'spot' | 'futures', symbol: string) => string | null;
}

function ScoreCell({
  score,
  loading,
}: {
  score: SetupScore | null | undefined;
  loading: boolean;
}) {
  const copy = useCopy();
  const w = copy.watchlist;
  if (loading)
    return <span className="h-4 w-8 animate-pulse rounded bg-raised" />;
  if (!score || score.score === null)
    return (
      <span
        className="font-mono text-xs text-muted-x"
        title={w.scoreInsufficient}
      >
        <span aria-hidden="true">—</span>
        <span className="sr-only">{w.scoreInsufficient}</span>
      </span>
    );
  const title = formatCopy(w.scoreTitle, {
    preset: copy.analysis[`preset${score.preset}`],
    version: score.presetVersion,
    timeframe: score.timeframe,
  });
  return (
    <span title={title} className="font-mono text-xs font-semibold text-fg-2">
      <span className="sr-only">{title}: </span>
      {score.score}
    </span>
  );
}

function Row({
  item,
  prices,
  score,
  scoreLoading,
  disabled,
  first,
  last,
  dragOver,
  onCreateAlert,
  onEdit,
  onRemove,
  onMove,
  dragProps,
}: {
  item: WatchlistItem;
  prices: WatchlistPrices;
  score: SetupScore | null | undefined;
  scoreLoading: boolean;
  disabled: boolean;
  first: boolean;
  last: boolean;
  dragOver: boolean;
  onCreateAlert: () => void;
  onEdit: () => void;
  onRemove: () => void;
  onMove: (step: -1 | 1) => void;
  dragProps: {
    onDragStart: (event: DragEvent) => void;
    onDragOver: (event: DragEvent) => void;
    onDrop: (event: DragEvent) => void;
    onDragEnd: () => void;
  };
}) {
  const copy = useCopy();
  const w = copy.watchlist;
  const label = pairLabel(item.symbol);
  const listed = item.spotListed || item.futuresListed;
  const market = item.spotListed ? 'spot' : 'futures';
  const ticker = (item.spotListed ? prices.spot : prices.futures).get(
    item.symbol,
  );
  const price = item.spotListed ? ticker?.lastPrice : ticker?.markPrice;
  const change = item.spotListed ? ticker?.changePercent24h : null;
  const base = label.split('/')[0] ?? item.symbol;
  const menu: MenuItem[] = [
    {
      id: 'edit',
      label: w.editRow,
      icon: <Pencil size={13} aria-hidden="true" />,
      onSelect: onEdit,
    },
    ...(first
      ? []
      : [
          {
            id: 'up',
            label: w.moveUp,
            icon: <ArrowUp size={13} aria-hidden="true" />,
            onSelect: () => onMove(-1),
          },
        ]),
    ...(last
      ? []
      : [
          {
            id: 'down',
            label: w.moveDown,
            icon: <ArrowDown size={13} aria-hidden="true" />,
            onSelect: () => onMove(1),
          },
        ]),
    {
      id: 'remove',
      label: w.remove,
      tone: 'danger',
      icon: <Trash2 size={13} aria-hidden="true" />,
      onSelect: onRemove,
    },
  ];
  const iconButton =
    'inline-flex size-7 items-center justify-center rounded-lg text-muted-dim hover:bg-raised hover:text-primary disabled:cursor-not-allowed disabled:opacity-40 pointer-coarse:size-9';
  return (
    <li
      className={classNames(
        'flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border bg-surface p-3 sm:flex-nowrap sm:p-4',
        dragOver ? 'border-primary' : 'border-line hover:border-line-strong',
        !listed && 'opacity-70',
      )}
      draggable={!disabled}
      {...dragProps}
    >
      <span
        className="hidden cursor-grab text-muted-x md:inline-flex"
        title={formatCopy(w.dragHandle, { pair: label })}
        aria-hidden="true"
      >
        <GripVertical size={14} />
      </span>
      <span
        aria-hidden="true"
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-line-strong bg-raised text-[11px] font-bold text-fg-2"
      >
        {base.slice(0, 2)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {listed ? (
            <Link
              to={`/markets/${market}/${item.symbol}`}
              className="text-sm font-semibold text-fg no-underline hover:text-primary"
            >
              {label}
            </Link>
          ) : (
            <span className="text-sm font-semibold text-fg">{label}</span>
          )}
          {!listed && (
            <span title={w.delistedHint}>
              <Badge>{w.delisted}</Badge>
            </span>
          )}
        </div>
        {item.note && (
          <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-x sm:line-clamp-1">
            {item.note}
          </p>
        )}
      </div>
      <div className="ml-auto flex items-center gap-4 sm:ml-0">
        <div className="min-w-24 text-right">
          <div className="text-sm font-semibold text-fg">
            {price ? (
              <NumericText
                value={formatPrice(price, prices.tick(market, item.symbol))}
              />
            ) : (
              <span className="text-muted-x">{copy.market.noValue}</span>
            )}
          </div>
          {change && (
            <div className="text-xs">
              <NumericText
                value={toFixedDecimal(change, 2)}
                signed
                suffix="%"
              />
            </div>
          )}
        </div>
        <div className="w-10 text-right">
          <span className="block text-[9px] font-semibold tracking-widest text-muted-x uppercase">
            {w.score}
          </span>
          <ScoreCell
            score={item.spotListed ? score : null}
            loading={item.spotListed && scoreLoading}
          />
        </div>
        <span
          className="w-14 text-right text-[11px] text-muted-dim"
          title={formatCopy(w.activeAlertsLabel, { count: item.activeAlerts })}
        >
          {formatCopy(w.activeAlerts, { count: item.activeAlerts })}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className={iconButton}
            aria-label={formatCopy(w.createAlertFor, { pair: label })}
            title={w.createAlert}
            onClick={onCreateAlert}
            disabled={disabled || !listed}
          >
            <Bell size={14} aria-hidden="true" />
          </button>
          {disabled ? (
            <span className={iconButton} aria-hidden="true">
              <MoreHorizontal size={14} className="opacity-40" />
            </span>
          ) : (
            <Menu
              label={formatCopy(w.actionsFor, { pair: label })}
              trigger={
                <span className={iconButton}>
                  <MoreHorizontal size={14} aria-hidden="true" />
                </span>
              }
              items={menu}
            />
          )}
        </div>
      </div>
    </li>
  );
}

/**
 * SCR-12 rows (Figma Watchlist cards; SRS 3.4.1): grouped by label, with
 * last price and 24h change from the live tickers, the setup score, the
 * number of active alerts, and per row Create alert, Edit, Move and Remove.
 * Rows drag within their group on a pointer device; Move up / down is the
 * keyboard path. A pair an admin disabled stays, greyed (Q-29).
 */
export function WatchlistGroups({
  items,
  prices,
  scores,
  scoresLoading,
  disabled,
  onCreateAlert,
  onEdit,
  onRemove,
  onReorder,
}: {
  items: readonly WatchlistItem[];
  prices: WatchlistPrices;
  scores: ReadonlyMap<string, SetupScore> | undefined;
  scoresLoading: boolean;
  disabled: boolean;
  onCreateAlert: (item: WatchlistItem) => void;
  onEdit: (item: WatchlistItem) => void;
  onRemove: (item: WatchlistItem) => void;
  onReorder: (ordered: string[]) => void;
}) {
  const copy = useCopy();
  const w = copy.watchlist;
  const groups = groupRows(items);
  const [dragged, setDragged] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const reorder = (
    id: string,
    target: { step: -1 | 1 } | { beforeId: string },
  ) => {
    const next = moveWithinGroup(groups, id, target);
    if (next) onReorder(next);
  };
  return (
    <div className="grid gap-6">
      {groups.map((group) => (
        <section
          key={group.label ?? ''}
          aria-label={group.label ?? w.unlabelled}
        >
          <h2 className="mb-3 text-[10px] font-semibold tracking-widest text-muted-x uppercase">
            {formatCopy(w.groupCount, {
              label: group.label ?? w.unlabelled,
              count: group.items.length,
            })}
          </h2>
          <ul className="grid gap-3">
            {group.items.map((item, index) => (
              <Row
                key={item.id}
                item={item}
                prices={prices}
                score={scores?.get(item.symbol)}
                scoreLoading={scoresLoading}
                disabled={disabled}
                first={index === 0}
                last={index === group.items.length - 1}
                dragOver={over === item.id && dragged !== item.id}
                onCreateAlert={() => onCreateAlert(item)}
                onEdit={() => onEdit(item)}
                onRemove={() => onRemove(item)}
                onMove={(step) => reorder(item.id, { step })}
                dragProps={{
                  onDragStart: (event) => {
                    event.dataTransfer.effectAllowed = 'move';
                    setDragged(item.id);
                  },
                  onDragOver: (event) => {
                    if (!dragged || !group.items.some((i) => i.id === dragged))
                      return;
                    event.preventDefault();
                    setOver(item.id);
                  },
                  onDrop: (event) => {
                    event.preventDefault();
                    if (dragged) reorder(dragged, { beforeId: item.id });
                    setDragged(null);
                    setOver(null);
                  },
                  onDragEnd: () => {
                    setDragged(null);
                    setOver(null);
                  },
                }}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
