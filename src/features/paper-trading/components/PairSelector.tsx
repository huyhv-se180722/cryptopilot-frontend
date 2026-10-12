import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { ArrowDown, ArrowUp, ChevronDown, Search, Star, X } from 'lucide-react';
import { NumericText } from '../../../components/ui/NumericText';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { useCopy } from '../../../hooks/use-copy';
import { formatCopy } from '../../../i18n/copy';
import type { MarketPair, MarketTicker } from '../../../types/domain';
import { classNames } from '../../../utils/class-names';
import {
  compactDecimal,
  compareDecimal,
  formatPrice,
  toFixedDecimal,
} from '../../../utils/decimal-format';

/** The Trader's watched Spot pairs, as far as they are known. */
export type FavoritePairs =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; symbols: ReadonlySet<string> };

type SortKey = 'pair' | 'last' | 'change' | 'volume';
interface Sort {
  key: SortKey;
  descending: boolean;
}

const FAVORITES = 'favorites';

const pick: Record<
  Exclude<SortKey, 'pair'>,
  (ticker: MarketTicker | undefined) => string | null
> = {
  last: (ticker) => ticker?.lastPrice ?? null,
  change: (ticker) => ticker?.changePercent24h ?? null,
  volume: (ticker) => ticker?.quoteVolume24h ?? null,
};

/** Missing values sort last in either direction, like the market table. */
function compare(
  a: MarketPair,
  b: MarketPair,
  sort: Sort | null,
  tickers: ReadonlyMap<string, MarketTicker>,
): number {
  if (!sort) return a.displayOrder - b.displayOrder;
  const direction = sort.descending ? -1 : 1;
  if (sort.key === 'pair') return a.symbol.localeCompare(b.symbol) * direction;
  const x = pick[sort.key](tickers.get(a.symbol));
  const y = pick[sort.key](tickers.get(b.symbol));
  if (x === null || y === null) return x === y ? 0 : x === null ? 1 : -1;
  return compareDecimal(x, y) * direction;
}

const matches = (pair: MarketPair, query: string) => {
  const needle = query.trim().toUpperCase().replace('/', '');
  return (
    needle === '' ||
    pair.symbol.includes(needle) ||
    (pair.baseAssetName ?? '').toUpperCase().includes(needle)
  );
};

/**
 * Pair switcher of the trading screen (B pair selector): search by symbol
 * or name, a Favorites tab from the watchlist and one tab per quote asset,
 * sortable columns with live prices. Arrow keys move, Enter opens, Escape
 * closes. A phone gets the list as a full-screen sheet.
 */
export function PairSelector({
  pairs,
  tickers,
  favorites,
  current,
  onSelect,
}: {
  pairs: readonly MarketPair[];
  tickers: ReadonlyMap<string, MarketTicker>;
  favorites: FavoritePairs;
  current: MarketPair;
  onSelect: (symbol: string) => void;
}) {
  const copy = useCopy();
  const p = copy.paper;
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const label = `${current.baseAsset ?? current.symbol}/${current.quoteAsset ?? ''}`;

  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };

  // A press outside the panel closes it, like a menu.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  return (
    <div ref={root} className="relative shrink-0">
      <button
        ref={trigger}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={formatCopy(p.choosePair, { pair: label })}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-lg font-semibold text-fg hover:bg-raised pointer-coarse:h-11"
      >
        {current.baseAsset ?? current.symbol}
        <span className="font-normal text-muted-dim">
          /{current.quoteAsset ?? ''}
        </span>
        <ChevronDown
          size={16}
          aria-hidden="true"
          className={classNames(
            'text-muted transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>
      {open && (
        <PairPanel
          pairs={pairs}
          tickers={tickers}
          favorites={favorites}
          current={current.symbol}
          onClose={close}
          onSelect={(symbol) => {
            setOpen(false);
            if (symbol !== current.symbol) onSelect(symbol);
          }}
        />
      )}
    </div>
  );
}

function PairPanel({
  pairs,
  tickers,
  favorites,
  current,
  onClose,
  onSelect,
}: {
  pairs: readonly MarketPair[];
  tickers: ReadonlyMap<string, MarketTicker>;
  favorites: FavoritePairs;
  current: string;
  onClose: () => void;
  onSelect: (symbol: string) => void;
}) {
  const copy = useCopy();
  const p = copy.paper;
  const m = copy.market;
  const listId = useId();
  const titleId = useId();
  const search = useRef<HTMLInputElement>(null);
  const quotes = useMemo(
    () => [...new Set(pairs.map((pair) => pair.quoteAsset ?? ''))],
    [pairs],
  );
  const currentQuote =
    pairs.find((pair) => pair.symbol === current)?.quoteAsset ?? quotes[0];
  const [tab, setTab] = useState<string>(currentQuote ?? FAVORITES);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort | null>(null);
  const [active, setActive] = useState(0);

  useEffect(() => search.current?.focus(), []);

  const favoriteSymbols =
    favorites.status === 'ready' ? favorites.symbols : null;
  const rows = pairs
    .filter((pair) =>
      tab === FAVORITES
        ? (favoriteSymbols?.has(pair.symbol) ?? false)
        : (pair.quoteAsset ?? '') === tab,
    )
    .filter((pair) => matches(pair, query))
    .sort((a, b) => compare(a, b, sort, tickers));
  const activeIndex = Math.min(active, Math.max(rows.length - 1, 0));
  const optionId = (index: number) => `${listId}-option-${index}`;

  const toggleSort = (key: SortKey) => {
    setSort((previous) =>
      previous?.key === key
        ? previous.descending
          ? null
          : { key, descending: true }
        : { key, descending: key === 'pair' ? false : true },
    );
    setActive(0);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (rows.length === 0) return;
      const step = event.key === 'ArrowDown' ? 1 : -1;
      const next = (activeIndex + step + rows.length) % rows.length;
      setActive(next);
      document
        .getElementById(optionId(next))
        ?.scrollIntoView?.({ block: 'nearest' });
    } else if (event.key === 'Enter') {
      const row = rows[activeIndex];
      if (row) {
        event.preventDefault();
        onSelect(row.symbol);
      }
    }
  };

  const columns: readonly { key: SortKey; label: string; end?: boolean }[] = [
    { key: 'pair', label: m.colPair },
    { key: 'last', label: m.colLast, end: true },
    { key: 'change', label: m.colChange, end: true },
    { key: 'volume', label: m.colVolume, end: true },
  ];
  const grid =
    'grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,0.8fr)] items-center gap-2';

  let empty: string | null = null;
  if (rows.length === 0)
    empty =
      tab === FAVORITES && favorites.status === 'error'
        ? favorites.message
        : tab === FAVORITES && favorites.status === 'loading'
          ? copy.common.loading
          : tab === FAVORITES && query.trim() === ''
            ? p.favoritesEmpty
            : copy.messages.MSG41;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onClose();
        }
      }}
      className="fixed inset-0 z-50 flex flex-col bg-surface p-4 sm:absolute sm:inset-auto sm:top-full sm:left-0 sm:mt-2 sm:h-auto sm:max-h-[520px] sm:w-[440px] sm:rounded-xl sm:border sm:border-line-strong sm:p-3 sm:shadow-overlay"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 id={titleId} className="text-sm font-semibold text-fg">
          {p.pairsTitle}
        </h2>
        <button
          type="button"
          aria-label={copy.common.close}
          title={copy.common.close}
          onClick={onClose}
          className="inline-flex size-8 items-center justify-center rounded-lg text-muted-dim hover:bg-raised hover:text-fg-2 sm:hidden"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
      <label className="relative mb-3 block">
        <span className="sr-only">{p.searchLabel}</span>
        <Search
          size={14}
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-dim"
        />
        <input
          ref={search}
          type="search"
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            rows.length > 0 ? optionId(activeIndex) : undefined
          }
          value={query}
          placeholder={p.searchPlaceholder}
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          className="h-9 w-full rounded-lg border border-line bg-raised pr-3 pl-9 text-xs text-fg placeholder:text-muted-dim focus:border-primary-line focus:outline-none pointer-coarse:h-11"
        />
      </label>
      <div className="mb-2">
        <SegmentedControl
          label={p.pairsTitle}
          value={tab}
          onChange={(value) => {
            setTab(value);
            setActive(0);
          }}
          options={[
            {
              value: FAVORITES,
              label: p.favorites,
              icon: <Star size={11} aria-hidden="true" />,
            },
            ...quotes.map((quote) => ({ value: quote, label: quote })),
          ]}
        />
      </div>
      <div
        className={classNames(
          grid,
          'border-b border-line px-2 py-1.5 text-[10px] font-semibold tracking-wider text-muted-x uppercase',
        )}
      >
        {columns.map((column) => {
          const sorted = sort?.key === column.key ? sort : null;
          const Arrow = sorted?.descending ? ArrowDown : ArrowUp;
          return (
            <button
              key={column.key}
              type="button"
              onClick={() => toggleSort(column.key)}
              aria-label={formatCopy(p.sortBy, { column: column.label })}
              aria-pressed={sorted !== null}
              className={classNames(
                'inline-flex min-w-0 items-center gap-1 uppercase hover:text-fg-2',
                column.end && 'justify-end',
                sorted && 'text-fg-2',
              )}
            >
              <span className="truncate">{column.label}</span>
              {sorted && <Arrow size={10} aria-hidden="true" />}
            </button>
          );
        })}
      </div>
      <ul
        id={listId}
        role="listbox"
        aria-label={p.pairsTitle}
        className="min-h-0 flex-1 overflow-y-auto sm:max-h-[360px]"
      >
        {rows.map((pair, index) => {
          const ticker = tickers.get(pair.symbol);
          const selected = pair.symbol === current;
          return (
            <li
              key={pair.symbol}
              id={optionId(index)}
              role="option"
              aria-selected={selected}
              onPointerMove={() => setActive(index)}
              onClick={() => onSelect(pair.symbol)}
              className={classNames(
                grid,
                'h-9 cursor-pointer rounded-md px-2 text-xs pointer-coarse:h-11',
                index === activeIndex && 'bg-raised-hover',
                selected && 'text-primary',
              )}
            >
              <span className="flex min-w-0 items-center gap-1.5">
                {favoriteSymbols?.has(pair.symbol) && (
                  <Star
                    size={11}
                    aria-label={p.favorites}
                    className="shrink-0 fill-warning text-warning"
                  />
                )}
                <span className="truncate font-semibold">
                  {pair.baseAsset ?? pair.symbol}
                  <span className="font-normal text-muted-dim">
                    /{pair.quoteAsset ?? ''}
                  </span>
                </span>
              </span>
              <span className="truncate text-right">
                {ticker?.lastPrice ? (
                  <NumericText
                    value={formatPrice(ticker.lastPrice, pair.tickSize)}
                  />
                ) : (
                  m.noValue
                )}
              </span>
              <span className="truncate text-right">
                {ticker?.changePercent24h ? (
                  <NumericText
                    signed
                    value={toFixedDecimal(ticker.changePercent24h, 2)}
                    suffix="%"
                  />
                ) : (
                  m.noValue
                )}
              </span>
              <span className="truncate text-right text-muted">
                {ticker?.quoteVolume24h ? (
                  <NumericText value={compactDecimal(ticker.quoteVolume24h)} />
                ) : (
                  m.noValue
                )}
              </span>
            </li>
          );
        })}
      </ul>
      {empty && (
        <p role="status" className="py-8 text-center text-xs text-muted">
          {empty}
        </p>
      )}
    </div>
  );
}
