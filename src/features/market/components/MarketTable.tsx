import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { NumericText } from '../../../components/ui/NumericText';
import { useCopy } from '../../../hooks/use-copy';
import { formatCopy } from '../../../i18n/copy';
import type {
  MarketPair,
  MarketTicker,
  MarketType,
} from '../../../types/domain';
import { classNames } from '../../../utils/class-names';
import {
  compactDecimal,
  compareDecimal,
  formatPrice,
  fractionToPercent,
  toFixedDecimal,
} from '../../../utils/decimal-format';

type SortKey = 'order' | 'symbol' | 'price' | 'change' | 'volume' | 'funding';
type Direction = 'asc' | 'desc';

interface Row {
  pair: MarketPair;
  ticker: MarketTicker | undefined;
}

interface Column {
  id: string;
  header: string;
  sort?: SortKey;
  numeric?: boolean;
  /** Hidden below this breakpoint so 360 px keeps pair, price and change. */
  from?: 'md' | 'lg';
  cell: (row: Row) => ReactNode;
}

const visibleFrom = { md: 'hidden md:table-cell', lg: 'hidden lg:table-cell' };

function sortValue(row: Row, key: SortKey): string | null {
  const t = row.ticker;
  switch (key) {
    case 'price':
      return (row.pair.market === 'spot' ? t?.lastPrice : t?.markPrice) ?? null;
    case 'change':
      return t?.changePercent24h ?? null;
    case 'volume':
      return t?.quoteVolume24h ?? null;
    case 'funding':
      return t?.fundingRate ?? null;
    default:
      return null;
  }
}

function countdown(until: string | null, now: number): string | null {
  if (!until) return null;
  const seconds = Math.max(0, Math.floor((Date.parse(until) - now) / 1000));
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor(seconds / 60) % 60)}:${pad(seconds % 60)}`;
}

/**
 * SCR-01 / SCR-09 pair table (Figma market table): sortable headers,
 * tabular right-aligned numbers, prices at the pair's tick precision
 * (CR-02), signed and coloured changes. The pair cell is the row's action:
 * a link to the analysis (SCR-09) or a toggle that selects the pair
 * (SCR-01).
 */
export function MarketTable({
  market,
  pairs,
  tickers,
  now,
  selectedSymbol,
  onSelect,
  hrefOf,
  emptyMessage,
}: {
  market: MarketType;
  pairs: readonly MarketPair[];
  tickers: ReadonlyMap<string, MarketTicker>;
  now: number;
  selectedSymbol?: string | null;
  onSelect?: (pair: MarketPair) => void;
  hrefOf?: (pair: MarketPair) => string;
  emptyMessage: string;
}) {
  const copy = useCopy();
  const m = copy.market;
  const [sort, setSort] = useState<{ key: SortKey; direction: Direction }>({
    key: 'order',
    direction: 'asc',
  });
  const none = <span className="text-muted-x">{m.noValue}</span>;
  const price = (value: string | null, row: Row) =>
    value === null ? (
      none
    ) : (
      <NumericText value={formatPrice(value, row.pair.tickSize)} />
    );

  const pairCell = (row: Row) => {
    const { pair } = row;
    const selected = selectedSymbol === pair.symbol;
    const body = (
      <>
        <span
          aria-hidden="true"
          className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-line-strong bg-raised text-[10px] font-bold text-fg-2"
        >
          {pair.logoUrl ? (
            <img src={pair.logoUrl} alt="" className="size-full object-cover" />
          ) : (
            (pair.baseAsset ?? pair.symbol).slice(0, 2)
          )}
        </span>
        <span className="min-w-0 text-left">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-fg">
            {pair.baseAsset ?? pair.symbol}
            <span className="font-normal text-muted-dim">
              /{pair.quoteAsset ?? ''}
            </span>
            {pair.market === 'futures' && (
              <span className="rounded border border-line px-1 text-[9px] font-semibold tracking-wider text-muted uppercase">
                {m.perpetual}
              </span>
            )}
          </span>
          {pair.baseAssetName && (
            <span className="block truncate text-[11px] text-muted-dim">
              {pair.baseAssetName}
            </span>
          )}
        </span>
      </>
    );
    const action =
      'flex min-w-0 items-center gap-2.5 rounded-md no-underline outline-offset-2 focus-visible:outline-2 focus-visible:outline-primary';
    return hrefOf ? (
      <Link to={hrefOf(pair)} className={action}>
        {body}
      </Link>
    ) : (
      <button
        type="button"
        aria-pressed={selected}
        onClick={() => onSelect?.(pair)}
        className={classNames(action, 'cursor-pointer')}
      >
        {body}
      </button>
    );
  };

  const columns: readonly Column[] =
    market === 'spot'
      ? [
          { id: 'pair', header: m.colPair, sort: 'symbol', cell: pairCell },
          {
            id: 'last',
            header: m.colLast,
            sort: 'price',
            numeric: true,
            cell: (row) => price(row.ticker?.lastPrice ?? null, row),
          },
          {
            id: 'change',
            header: m.colChange,
            sort: 'change',
            numeric: true,
            cell: (row) =>
              row.ticker?.changePercent24h ? (
                <NumericText
                  signed
                  value={toFixedDecimal(row.ticker.changePercent24h, 2)}
                  suffix="%"
                />
              ) : (
                none
              ),
          },
          {
            id: 'high',
            header: m.colHigh,
            numeric: true,
            from: 'md',
            cell: (row) => price(row.ticker?.high24h ?? null, row),
          },
          {
            id: 'low',
            header: m.colLow,
            numeric: true,
            from: 'md',
            cell: (row) => price(row.ticker?.low24h ?? null, row),
          },
          {
            id: 'volume',
            header: m.colVolume,
            sort: 'volume',
            numeric: true,
            from: 'lg',
            cell: (row) =>
              row.ticker?.quoteVolume24h ? (
                <NumericText
                  value={compactDecimal(row.ticker.quoteVolume24h)}
                />
              ) : (
                none
              ),
          },
        ]
      : [
          { id: 'pair', header: m.colPair, sort: 'symbol', cell: pairCell },
          {
            id: 'mark',
            header: m.colMark,
            sort: 'price',
            numeric: true,
            cell: (row) => price(row.ticker?.markPrice ?? null, row),
          },
          {
            id: 'funding',
            header: m.colFunding,
            sort: 'funding',
            numeric: true,
            cell: (row) =>
              row.ticker?.fundingRate ? (
                <NumericText
                  signed
                  value={fractionToPercent(row.ticker.fundingRate, 4)}
                  suffix="%"
                />
              ) : (
                none
              ),
          },
          {
            id: 'index',
            header: m.colIndex,
            numeric: true,
            from: 'md',
            cell: (row) => price(row.ticker?.indexPrice ?? null, row),
          },
          {
            id: 'next',
            header: m.colNextFunding,
            numeric: true,
            from: 'md',
            cell: (row) => {
              const left = countdown(row.ticker?.nextFundingTime ?? null, now);
              return left ? <NumericText value={left} /> : none;
            },
          },
          {
            id: 'change',
            header: m.colChange,
            numeric: true,
            from: 'lg',
            // M-09: the backend has no Futures 24h statistics yet.
            cell: () => none,
          },
        ];

  const rows = useMemo(() => {
    const list = pairs.map((pair) => ({
      pair,
      ticker: tickers.get(pair.symbol),
    }));
    const factor = sort.direction === 'asc' ? 1 : -1;
    return list.sort((a, b) => {
      if (sort.key === 'order')
        return (a.pair.displayOrder - b.pair.displayOrder) * factor;
      if (sort.key === 'symbol')
        return a.pair.symbol.localeCompare(b.pair.symbol) * factor;
      const x = sortValue(a, sort.key);
      const y = sortValue(b, sort.key);
      // Pairs without a value stay last in both directions.
      if (x === null || y === null) return x === y ? 0 : x === null ? 1 : -1;
      return compareDecimal(x, y) * factor;
    });
  }, [pairs, tickers, sort]);

  const toggle = (key: SortKey) =>
    setSort((current) =>
      current.key !== key
        ? { key, direction: key === 'symbol' ? 'asc' : 'desc' }
        : current.direction === 'desc'
          ? { key, direction: 'asc' }
          : { key: 'order', direction: 'asc' },
    );

  const caption = formatCopy(m.tableCaption, {
    market: market === 'spot' ? m.spot : m.futures,
  });

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-line bg-page-alt">
              {columns.map((column) => {
                const active = column.sort && sort.key === column.sort;
                return (
                  <th
                    key={column.id}
                    scope="col"
                    aria-sort={
                      active
                        ? sort.direction === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : undefined
                    }
                    className={classNames(
                      'px-2.5 py-2.5 text-[11px] font-medium whitespace-nowrap sm:px-4',
                      column.numeric ? 'text-right' : 'text-left',
                      active ? 'text-fg-2' : 'text-muted-x',
                      column.from && visibleFrom[column.from],
                    )}
                  >
                    {column.sort ? (
                      <button
                        type="button"
                        onClick={() => toggle(column.sort as SortKey)}
                        className={classNames(
                          'inline-flex items-center gap-1 hover:text-fg-2',
                          column.numeric && 'flex-row-reverse',
                        )}
                      >
                        {column.header}
                        {active ? (
                          sort.direction === 'asc' ? (
                            <ArrowUp size={10} aria-hidden="true" />
                          ) : (
                            <ArrowDown size={10} aria-hidden="true" />
                          )
                        ) : (
                          <ArrowUpDown
                            size={10}
                            aria-hidden="true"
                            className="opacity-40"
                          />
                        )}
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-10 text-center text-xs text-muted"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.pair.symbol}
                  className={classNames(
                    'h-14 border-b border-line last:border-b-0 hover:bg-raised',
                    selectedSymbol === row.pair.symbol && 'bg-primary-soft',
                  )}
                >
                  {columns.map((column) => (
                    <td
                      key={column.id}
                      className={classNames(
                        'px-2.5 py-2 text-xs whitespace-nowrap sm:px-4',
                        column.numeric ? 'text-right text-fg' : 'text-left',
                        column.from && visibleFrom[column.from],
                      )}
                    >
                      {column.cell(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {market === 'futures' && (
        <p className="border-t border-line px-4 py-2 text-[11px] text-muted-dim">
          {m.futuresNoStats}
        </p>
      )}
    </div>
  );
}
