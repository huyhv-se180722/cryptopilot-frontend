import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { Skeleton } from '../../../components/ui/Skeleton';
import { Tabs } from '../../../components/ui/Tabs';
import { useCopy } from '../../../hooks/use-copy';
import { formatCopy } from '../../../i18n/copy';
import type { MarketPair, MarketType } from '../../../types/domain';
import { classNames } from '../../../utils/class-names';
import { compareDecimal, formatPrice } from '../../../utils/decimal-format';
import { useMarketBoard } from '../hooks/use-market-board';
import {
  OVERVIEW_RANGES,
  useOverviewCandles,
  type OverviewRange,
} from '../hooks/use-market-overview';
import { FreshnessBadge } from './FreshnessBadge';
import { OverviewChart } from './OverviewChart';
import {
  absoluteChange,
  overviewPrice,
  overviewRows,
  type OverviewTab,
} from './market-overview';

const TABS: readonly OverviewTab[] = ['spot', 'futures', 'gainers', 'losers'];
const RANGES = Object.keys(OVERVIEW_RANGES) as OverviewRange[];

/**
 * A live number that flashes green when it rises and red when it falls,
 * so a change in the stream is seen without reading every digit.
 */
function FlashingValue({ value, text }: { value: string; text: string }) {
  const previous = useRef(value);
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);
  useEffect(() => {
    if (value === previous.current) return;
    setFlash(compareDecimal(value, previous.current) > 0 ? 'up' : 'down');
    previous.current = value;
    const timer = window.setTimeout(() => setFlash(null), 700);
    return () => window.clearTimeout(timer);
  }, [value]);
  return (
    <span
      data-flash={flash ?? undefined}
      className={classNames(
        'rounded px-1 transition-colors duration-700',
        flash === 'up' && 'bg-positive-soft text-positive',
        flash === 'down' && 'bg-negative-soft text-negative',
      )}
    >
      {text}
    </span>
  );
}

/**
 * A market overview in the style of a news site's markets widget (D-126):
 * tabs for the Spot and Futures pairs and the 24-hour gainers and losers,
 * an area chart of the selected pair over 1D to 1Y, and a table of live
 * prices from the market stream (polled when it is late, CR-09), each row
 * selecting its pair for the chart. Crypto only: the platform's one data
 * source is the exchange.
 */
export function MarketOverview() {
  const copy = useCopy();
  const o = copy.marketOverview;
  const [tab, setTab] = useState<OverviewTab>('spot');
  const [range, setRange] = useState<OverviewRange>('1D');
  const [chosen, setChosen] = useState<string | null>(null);
  const market: MarketType = tab === 'futures' ? 'futures' : 'spot';
  const board = useMarketBoard(market);
  const rows = useMemo(
    () => overviewRows(tab, board.all, board.tickers),
    [tab, board.all, board.tickers],
  );
  const selected =
    rows.find((row) => row.pair.symbol === chosen) ?? rows[0] ?? null;
  const candles = useOverviewCandles(
    market,
    selected?.pair.symbol ?? null,
    range,
  );
  const name = (pair: MarketPair) =>
    (pair.baseAsset ?? pair.symbol) +
    (pair.quoteAsset ? '/' + pair.quoteAsset : '');

  const body = (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <SegmentedControl
          label={o.rangeLabel}
          options={RANGES.map((value) => ({ value, label: value }))}
          value={range}
          onChange={setRange}
        />
        <FreshnessBadge freshness={board.freshness} />
      </div>
      {selected && (
        <p className="mb-1 text-xs font-semibold text-fg">
          {name(selected.pair)}
        </p>
      )}
      {candles.data && candles.data.length > 0 && selected ? (
        <OverviewChart
          candles={candles.data}
          tickSize={selected.pair.tickSize}
          intraday={range === '1D' || range === '1W'}
          label={formatCopy(o.chartLabel, {
            pair: name(selected.pair),
            range,
          })}
        />
      ) : candles.isError ? (
        <p className="flex h-44 items-center justify-center text-xs text-muted">
          {o.chartUnavailable}
        </p>
      ) : (
        <Skeleton className="h-44 w-full rounded-lg" />
      )}

      {board.pairs.isPending ? (
        <div className="mt-3 grid gap-2">
          {[0, 1, 2, 3].map((k) => (
            <Skeleton key={k} className="h-7 w-full rounded" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="mt-3 text-xs text-muted">{o.empty}</p>
      ) : (
        <table className="mt-3 w-full text-xs">
          <thead className="sr-only">
            <tr>
              <th>{o.pair}</th>
              <th>{o.price}</th>
              <th>{o.change}</th>
              <th>{o.changePercent}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const price = overviewPrice(row);
              const percent = row.ticker?.changePercent24h ?? null;
              const up = percent !== null && !percent.startsWith('-');
              const tone =
                percent === null
                  ? 'text-muted'
                  : up
                    ? 'text-positive'
                    : 'text-negative';
              const isSelected = row.pair.symbol === selected?.pair.symbol;
              return (
                <tr
                  key={row.pair.symbol}
                  aria-selected={isSelected}
                  className={classNames(
                    'cursor-pointer border-b border-line last:border-b-0 hover:bg-raised',
                    isSelected && 'bg-primary-soft',
                  )}
                  onClick={() => setChosen(row.pair.symbol)}
                >
                  <td className="py-2 pr-2 font-semibold text-fg">
                    <button
                      type="button"
                      className="text-left"
                      aria-pressed={isSelected}
                      onClick={(event) => {
                        event.stopPropagation();
                        setChosen(row.pair.symbol);
                      }}
                    >
                      {name(row.pair)}
                    </button>
                  </td>
                  <td className="py-2 text-right font-mono tabular-nums text-fg">
                    {price === null ? (
                      o.noValue
                    ) : (
                      <FlashingValue
                        value={price}
                        text={formatPrice(price, row.pair.tickSize)}
                      />
                    )}
                  </td>
                  <td
                    className={classNames(
                      'hidden py-2 text-right font-mono tabular-nums sm:table-cell',
                      tone,
                    )}
                  >
                    {price !== null && percent !== null
                      ? absoluteChange(price, percent, row.pair.tickSize)
                      : o.noValue}
                  </td>
                  <td
                    className={classNames(
                      'py-2 pl-2 text-right font-mono tabular-nums',
                      tone,
                    )}
                  >
                    {percent === null
                      ? o.noValue
                      : (up ? '+' : '') + Number(percent).toFixed(2) + '%'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <Link
        to={market === 'futures' ? '/markets?market=futures' : '/markets'}
        className="mt-3 inline-block text-[11px] no-underline"
      >
        {o.allMarkets}
      </Link>
    </div>
  );

  return (
    <section
      aria-labelledby="market-overview-title"
      className="rounded-xl border border-line bg-surface p-4"
    >
      <h2
        id="market-overview-title"
        className="mb-2 text-[10px] font-semibold tracking-widest text-muted-x uppercase"
      >
        {o.title}
      </h2>
      <Tabs
        label={o.tabsLabel}
        items={TABS.map((id) => ({ id, label: o[`tab_${id}`], panel: body }))}
        value={tab}
        onChange={(id) => {
          setTab(id as OverviewTab);
          setChosen(null);
        }}
      />
    </section>
  );
}
