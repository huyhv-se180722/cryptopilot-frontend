import { useNavigate } from 'react-router-dom';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { CoinLogo } from '../../../components/ui/CoinLogo';
import { FlashingValue } from '../../../components/ui/FlashingValue';
import { useCopy } from '../../../hooks/use-copy';
import { formatCopy } from '../../../i18n/copy';
import { classNames } from '../../../utils/class-names';
import {
  bullishShare,
  compactAmount,
  compactUsd,
  formatUsd,
  type CoinSort,
  type CoinSortKey,
  type CoinView,
} from '../coin-market';
import { Change } from './CoinMarketCards';
import { SentimentBar, Sparkline } from './CoinCharts';

interface Column {
  key: CoinSortKey | null;
  label: string;
  className: string;
}

/**
 * The coin table of SCR-09, column for column what CoinMarketCap shows:
 * rank, name, price, 1h / 24h / 7d change, market cap, volume, supply,
 * the community's leaning and a week's chart. A row opens the coin's
 * analysis.
 */
export function CoinMarketTable({
  rows,
  sort,
  onSort,
}: {
  rows: readonly CoinView[];
  sort: CoinSort;
  onSort: (key: CoinSortKey) => void;
}) {
  const c = useCopy().coinMarket;
  const navigate = useNavigate();
  const columns: readonly Column[] = [
    { key: 'rank', label: c.colRank, className: 'w-10 text-center' },
    { key: 'name', label: c.colName, className: 'text-left' },
    { key: 'price', label: c.colPrice, className: 'text-right' },
    {
      key: 'change1h',
      label: c.col1h,
      className: 'hidden text-right md:table-cell',
    },
    { key: 'change24h', label: c.col24h, className: 'text-right' },
    {
      key: 'change7d',
      label: c.col7d,
      className: 'hidden text-right md:table-cell',
    },
    {
      key: 'marketCap',
      label: c.colMarketCap,
      className: 'hidden text-right lg:table-cell',
    },
    {
      key: 'volume24h',
      label: c.colVolume,
      className: 'hidden text-right lg:table-cell',
    },
    {
      key: 'supply',
      label: c.colSupply,
      className: 'hidden text-right xl:table-cell',
    },
    {
      key: null,
      label: c.colSentiment,
      className: 'hidden text-right xl:table-cell',
    },
    {
      key: null,
      label: c.colChart,
      className: 'hidden text-right sm:table-cell',
    },
  ];

  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <caption className="sr-only">{c.tableCaption}</caption>
        <thead>
          <tr className="border-b border-line text-xs text-fg-2">
            {columns.map((column) => {
              const active = column.key !== null && sort.key === column.key;
              const Arrow = sort.descending ? ArrowDown : ArrowUp;
              return (
                <th
                  key={column.label}
                  scope="col"
                  aria-sort={
                    active
                      ? sort.descending
                        ? 'descending'
                        : 'ascending'
                      : undefined
                  }
                  className={classNames(
                    'px-3 py-3 font-semibold',
                    column.className,
                  )}
                >
                  {column.key ? (
                    <button
                      type="button"
                      onClick={() => column.key && onSort(column.key)}
                      aria-label={formatCopy(c.sortBy, {
                        column: column.label,
                      })}
                      className={classNames(
                        'inline-flex items-center gap-1 hover:text-fg',
                        active && 'text-fg',
                      )}
                    >
                      {column.label}
                      {active && <Arrow size={11} aria-hidden="true" />}
                    </button>
                  ) : (
                    column.label
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const share = bullishShare(row.sentiment);
            const sentimentLabel =
              share === null
                ? c.neutral
                : share >= 0.55
                  ? c.bullish
                  : share <= 0.45
                    ? c.bearish
                    : c.neutral;
            return (
              <tr
                key={row.coin.symbol}
                onClick={() => row.href && navigate(row.href)}
                className={classNames(
                  'border-b border-line last:border-b-0 hover:bg-raised',
                  row.href && 'cursor-pointer',
                )}
              >
                <td className="px-3 py-3 text-center text-xs text-muted">
                  {index + 1}
                </td>
                <td className="px-3 py-3">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <CoinLogo src={row.coin.logoUrl} symbol={row.coin.symbol} />
                    <span className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                      {row.href ? (
                        <a
                          href={row.href}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            navigate(row.href!);
                          }}
                          className="truncate font-semibold text-fg no-underline hover:underline"
                        >
                          {row.coin.name}
                        </a>
                      ) : (
                        <span className="truncate font-semibold text-fg">
                          {row.coin.name}
                        </span>
                      )}
                      <span className="text-xs text-muted">
                        {row.coin.symbol}
                      </span>
                      {!row.coin.spotSymbol && row.coin.futuresSymbol && (
                        <span className="rounded border border-line px-1 text-[9px] font-semibold tracking-wider text-muted uppercase">
                          {c.perp}
                        </span>
                      )}
                    </span>
                  </span>
                </td>
                <td className="px-3 py-3 text-right font-mono font-semibold tabular-nums text-fg">
                  {row.price ? (
                    <FlashingValue
                      value={row.price}
                      text={formatUsd(row.price)}
                      holdMs={1500}
                    />
                  ) : (
                    '—'
                  )}
                </td>
                <td className="hidden px-3 py-3 text-right md:table-cell">
                  <Change value={row.change1h} />
                </td>
                <td className="px-3 py-3 text-right">
                  <Change value={row.change24h} />
                </td>
                <td className="hidden px-3 py-3 text-right md:table-cell">
                  <Change value={row.change7d} />
                </td>
                <td className="hidden px-3 py-3 text-right font-mono tabular-nums text-fg lg:table-cell">
                  {row.marketCap ? compactUsd(row.marketCap) : '—'}
                </td>
                <td className="hidden px-3 py-3 text-right font-mono tabular-nums text-fg lg:table-cell">
                  {row.volume24h ? compactUsd(row.volume24h) : '—'}
                </td>
                <td className="hidden px-3 py-3 text-right font-mono tabular-nums text-fg xl:table-cell">
                  {row.coin.circulatingSupply
                    ? `${compactAmount(row.coin.circulatingSupply)} ${row.coin.symbol}`
                    : '—'}
                </td>
                <td
                  className="hidden px-3 py-3 xl:table-cell"
                  title={
                    row.sentiment
                      ? formatCopy(c.sentimentHint, {
                          bullish: String(row.sentiment.bullish),
                          bearish: String(row.sentiment.bearish),
                        })
                      : undefined
                  }
                >
                  <SentimentBar share={share} label={sentimentLabel} />
                </td>
                <td className="hidden px-3 py-2 text-right sm:table-cell">
                  <span className="inline-flex justify-end">
                    <Sparkline
                      points={row.coin.sparkline7d}
                      latest={row.price}
                      label={formatCopy(c.chartLabel, {
                        symbol: row.coin.symbol,
                      })}
                    />
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
