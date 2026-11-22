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
import { CoinLogo } from '../../../components/ui/CoinLogo';
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

/**
 * The columns of a row from 1024 px (T-142): drag, pair, note, price, 24h,
 * setup score, alerts, actions. Below that a row wraps as a card.
 */
const COLUMNS =
  'lg:grid lg:grid-cols-[14px_minmax(150px,1.1fr)_minmax(0,1.4fr)_110px_84px_120px_76px_68px] lg:gap-x-4';

export interface WatchlistPrices {
  spot: ReadonlyMap<string, MarketTicker>;
  futures: ReadonlyMap<string, MarketTicker>;
  /** Tick size per market and symbol (CR-02); null until known. */
  tick: (market: 'spot' | 'futures', symbol: string) => string | null;
  /** The coin's logo from the pair list already loaded, as on the market list. */
  logo: (symbol: string) => string | null;
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
  const markets = [
    item.spotListed ? copy.market.spot : null,
    item.futuresListed ? copy.market.futures : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const value = score?.score ?? null;
  return (
    <li
      className={classNames(
        'flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line px-3 py-3 sm:px-4',
        COLUMNS,
        dragOver ? 'bg-primary-soft' : 'hover:bg-raised/40',
        !listed && 'opacity-70',
      )}
      draggable={!disabled}
      {...dragProps}
    >
      <span
        className="hidden cursor-grab text-muted-x lg:inline-flex"
        title={formatCopy(w.dragHandle, { pair: label })}
        aria-hidden="true"
      >
        <GripVertical size={14} />
      </span>
      <div className="flex min-w-[150px] flex-1 items-center gap-2.5 lg:min-w-0">
        <CoinLogo src={prices.logo(item.symbol)} symbol={base} />
        <div className="min-w-0">
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
          {markets && (
            <span className="block text-xs text-muted-dim">{markets}</span>
          )}
        </div>
      </div>
      <p
        className={classNames(
          'order-last m-0 w-full min-w-0 text-xs text-fg-2 lg:order-none lg:w-auto lg:truncate',
          !item.note && 'hidden lg:block lg:text-muted-x',
        )}
        title={item.note ?? undefined}
      >
        {item.note ?? <span aria-hidden="true">{copy.market.noValue}</span>}
      </p>
      <div className="ml-auto text-right font-mono text-sm font-semibold text-fg lg:ml-0">
        {price ? (
          <NumericText
            value={formatPrice(price, prices.tick(market, item.symbol))}
          />
        ) : (
          <span className="text-muted-x">{copy.market.noValue}</span>
        )}
      </div>
      <div className="w-20 text-right lg:w-auto">
        {change ? (
          <span
            className={classNames(
              'inline-flex rounded px-1.5 py-0.5 font-mono text-xs font-semibold',
              change.startsWith('-') ? 'bg-negative-soft' : 'bg-positive-soft',
            )}
          >
            <NumericText value={toFixedDecimal(change, 2)} signed suffix="%" />
          </span>
        ) : (
          <span className="font-mono text-xs text-muted-x">
            {copy.market.noValue}
          </span>
        )}
      </div>
      <div className="flex w-24 items-center gap-2 lg:w-auto">
        <span className="text-xs font-semibold text-muted-x lg:sr-only">
          {w.score}
        </span>
        <ScoreCell
          score={item.spotListed ? score : null}
          loading={item.spotListed && scoreLoading}
        />
        {item.spotListed && value !== null && (
          <span
            aria-hidden="true"
            className="hidden h-1 flex-1 overflow-hidden rounded-sm bg-raised lg:block"
          >
            <span
              className={classNames(
                'block h-full',
                value >= 70
                  ? 'bg-positive'
                  : value >= 40
                    ? 'bg-warning'
                    : 'bg-negative',
              )}
              style={{ width: `${value}%` }}
            />
          </span>
        )}
      </div>
      <span
        className="text-xs text-muted-dim"
        title={formatCopy(w.activeAlertsLabel, { count: item.activeAlerts })}
      >
        {formatCopy(w.activeAlerts, { count: item.activeAlerts })}
      </span>
      <div className="flex items-center justify-end gap-1">
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
    </li>
  );
}

/**
 * SCR-12 rows (SRS 3.4.1; one table-like panel since T-142, a card per
 * row below 1024 px): grouped by label, with
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
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      <div
        aria-hidden="true"
        className={classNames(
          'hidden px-4 py-3 text-xs font-medium text-muted-x',
          COLUMNS,
        )}
      >
        <span />
        <span>{w.colPair}</span>
        <span>{w.colNote}</span>
        <span className="text-right">{w.colPrice}</span>
        <span className="text-right">{w.colChange}</span>
        <span>{w.score}</span>
        <span>{w.colAlerts}</span>
        <span />
      </div>
      {groups.map((group) => (
        <section
          key={group.label ?? ''}
          aria-label={group.label ?? w.unlabelled}
        >
          <h2 className="m-0 border-t border-line bg-surface-alt px-4 py-2 text-xs font-semibold text-muted">
            {formatCopy(w.groupCount, {
              label: group.label ?? w.unlabelled,
              count: group.items.length,
            })}
          </h2>
          <ul className="m-0 list-none p-0">
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
