import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState, ErrorState } from '../../../components/feedback/States';
import { Badge } from '../../../components/ui/Badge';
import { NumericText } from '../../../components/ui/NumericText';
import { Skeleton } from '../../../components/ui/Skeleton';
import { useCopy } from '../../../hooks/use-copy';
import { formatCopy } from '../../../i18n/copy';
import { errorText } from '../../../i18n/messages';
import type { MarketPair, MarketTicker } from '../../../types/domain';
import { classNames } from '../../../utils/class-names';
import {
  compactDecimal,
  compareDecimal,
  formatPrice,
  toFixedDecimal,
} from '../../../utils/decimal-format';
import { signOf } from '../../../utils/decimal-sign';
import { pairLabel } from '../../../utils/pair-label';
import { useWatchlist } from '../../watchlist/hooks/use-watchlist';

type Tab = 'watch' | 'gainers' | 'losers';
/** Rows of a movers list. */
const MOVERS = 6;
const GRID =
  'grid grid-cols-[minmax(0,1fr)_auto_4.75rem] items-center gap-x-3 px-3.5';

function Change({ value, none }: { value: string | null; none: string }) {
  if (value === null)
    return <span className="text-right text-muted-x">{none}</span>;
  const sign = signOf(value);
  return (
    <span
      className={classNames(
        'rounded px-1.5 py-0.5 text-right font-mono text-xs font-semibold',
        sign === 'negative'
          ? 'bg-negative-soft'
          : sign === 'positive'
            ? 'bg-positive-soft'
            : 'bg-raised',
      )}
    >
      <NumericText signed value={toFixedDecimal(value, 2)} suffix="%" />
    </span>
  );
}

function Name({ symbol, pair }: { symbol: string; pair?: MarketPair }) {
  const [base, quote] = pair
    ? [pair.baseAsset ?? symbol, pair.quoteAsset]
    : pairLabel(symbol).split('/');
  return (
    <span className="text-sm font-semibold text-fg">
      {base}
      {quote && <span className="font-medium text-muted-dim">/{quote}</span>}
    </span>
  );
}

/**
 * The right rail of SCR-08 (T-139, A-68): the Trader's watchlist in their
 * order, or the Spot pairs that rose or fell most in 24 hours, from the
 * live tickers the page already reads. A Spot pair is picked for the
 * chart beside it; a Futures-only pair opens its analysis, and a pair no
 * longer listed stays greyed without an action, as on SCR-12 (Q-29).
 */
export function MarketRail({
  pairs,
  tickers,
  selected,
  onSelect,
}: {
  pairs: readonly MarketPair[];
  tickers: ReadonlyMap<string, MarketTicker>;
  selected: string | null;
  onSelect: (symbol: string) => void;
}) {
  const copy = useCopy();
  const d = copy.dashboard;
  const w = copy.watchlist;
  const none = copy.market.noValue;
  const [tab, setTab] = useState<Tab>('watch');
  const list = useWatchlist();
  const items = list.data?.items ?? [];
  const pairOf = (symbol: string) =>
    pairs.find((each) => each.symbol === symbol);

  const row = (
    key: string,
    symbol: string,
    meta: ReactNode,
    action: 'select' | { to: string } | 'none',
  ) => {
    const pair = pairOf(symbol);
    const ticker = action === 'none' ? undefined : tickers.get(symbol);
    const cells = (
      <>
        <span className="flex min-w-0 flex-col gap-0.5">
          <Name symbol={symbol} {...(pair ? { pair } : {})} />
          <span className="truncate text-xs text-muted-dim">{meta}</span>
        </span>
        <span className="text-right font-mono text-xs text-fg">
          {ticker?.lastPrice ? (
            <NumericText
              value={formatPrice(ticker.lastPrice, pair?.tickSize ?? null)}
            />
          ) : (
            none
          )}
        </span>
        <Change value={ticker?.changePercent24h ?? null} none={none} />
      </>
    );
    const base = classNames(GRID, 'min-h-12 w-full py-1.5 text-left');
    if (action === 'select') {
      const on = selected === symbol;
      return (
        <li key={key} className="border-t border-line">
          <button
            type="button"
            aria-pressed={on}
            onClick={() => onSelect(symbol)}
            className={classNames(
              base,
              'cursor-pointer',
              on ? 'bg-primary-soft' : 'hover:bg-raised',
            )}
          >
            {cells}
          </button>
        </li>
      );
    }
    if (action === 'none')
      return (
        <li key={key} className="border-t border-line opacity-70">
          <div className={base}>{cells}</div>
        </li>
      );
    return (
      <li key={key} className="border-t border-line">
        <Link
          to={action.to}
          className={classNames(base, 'text-fg no-underline hover:bg-raised')}
        >
          {cells}
        </Link>
      </li>
    );
  };

  let body: ReactNode;
  if (tab === 'watch') {
    if (list.isPending) body = <Skeleton className="m-3.5 h-48" />;
    else if (list.isError)
      body = (
        <div className="p-3.5">
          <ErrorState
            variant="inline"
            message={errorText(copy, list.error)}
            onRetry={() => void list.refetch()}
          />
        </div>
      );
    else if (items.length === 0)
      body = (
        <div className="p-3.5">
          <EmptyState
            variant="inline"
            title={w.empty}
            description={w.emptyHint}
            action={<Link to="/markets">{w.browseMarkets}</Link>}
          />
        </div>
      );
    else
      body = (
        <ul>
          {items.map((item) => {
            const listed = item.spotListed || item.futuresListed;
            if (!listed)
              return row(
                item.id,
                item.symbol,
                <span title={w.delistedHint}>
                  <Badge>{w.delisted}</Badge>
                  <span className="sr-only"> {w.delistedHint}</span>
                </span>,
                'none',
              );
            const meta =
              [
                item.label,
                item.activeAlerts > 0
                  ? formatCopy(d.railAlerts, { count: item.activeAlerts })
                  : null,
                item.note,
              ]
                .filter(Boolean)
                .join(' · ') || (item.spotListed ? '' : d.railFuturesOnly);
            return item.spotListed && pairOf(item.symbol)
              ? row(item.id, item.symbol, meta, 'select')
              : row(item.id, item.symbol, meta || d.railFuturesOnly, {
                  to: `/markets/futures/${item.symbol}`,
                });
          })}
        </ul>
      );
  } else {
    const moving = pairs
      .map((pair) => ({ pair, ticker: tickers.get(pair.symbol) }))
      .filter(
        (each): each is { pair: MarketPair; ticker: MarketTicker } =>
          typeof each.ticker?.changePercent24h === 'string',
      )
      .sort((a, b) =>
        compareDecimal(
          b.ticker.changePercent24h as string,
          a.ticker.changePercent24h as string,
        ),
      );
    const shown = (tab === 'gainers' ? moving : moving.reverse()).slice(
      0,
      MOVERS,
    );
    body = shown.length ? (
      <ol>
        {shown.map(({ pair, ticker }) =>
          row(
            pair.symbol,
            pair.symbol,
            ticker.quoteVolume24h
              ? formatCopy(d.railVolume, {
                  volume: compactDecimal(ticker.quoteVolume24h),
                })
              : '',
            'select',
          ),
        )}
      </ol>
    ) : (
      <p className="px-3.5 py-6 text-center text-xs text-muted-dim">
        {d.railMoversEmpty}
      </p>
    );
  }

  const tabs: { value: Tab; label: string }[] = [
    {
      value: 'watch',
      label: formatCopy(d.railWatch, { count: items.length }),
    },
    { value: 'gainers', label: d.railGainers },
    { value: 'losers', label: d.railLosers },
  ];

  return (
    <aside
      aria-label={d.railLabel}
      className="flex min-w-0 flex-col rounded-xl border border-line bg-surface"
    >
      <div className="flex flex-wrap items-center gap-1 border-b border-line px-3 py-2.5">
        <div role="group" aria-label={d.railTabs} className="flex gap-1">
          {tabs.map((each) => (
            <button
              key={each.value}
              type="button"
              aria-pressed={tab === each.value}
              onClick={() => setTab(each.value)}
              className={classNames(
                'h-7 cursor-pointer rounded-md px-2 text-xs font-semibold whitespace-nowrap',
                tab === each.value
                  ? 'bg-primary-soft text-link'
                  : 'text-muted hover:text-fg',
              )}
            >
              {each.label}
            </button>
          ))}
        </div>
        <Link to="/watchlist" className="ml-auto text-xs no-underline">
          {d.manage}
        </Link>
      </div>
      <div
        aria-hidden="true"
        className={classNames(GRID, 'py-2 text-xs font-semibold text-muted')}
      >
        <span>{d.railPair}</span>
        <span className="text-right">{d.railPrice}</span>
        <span className="text-right">{d.railChange}</span>
      </div>
      <div className="max-h-[26rem] flex-1 overflow-y-auto">{body}</div>
      <p className="border-t border-line px-3.5 py-2.5 text-xs text-muted-dim">
        {tab === 'watch' ? d.railFootWatch : d.railFootMovers}
      </p>
    </aside>
  );
}
