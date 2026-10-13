import { Link } from 'react-router-dom';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { EmptyState, ErrorState } from '../../../components/feedback/States';
import { NumericText } from '../../../components/ui/NumericText';
import { Skeleton } from '../../../components/ui/Skeleton';
import { useCopy } from '../../../hooks/use-copy';
import { errorText } from '../../../i18n/messages';
import type { MarketPair, MarketTicker } from '../../../types/domain';
import { classNames } from '../../../utils/class-names';
import { formatPrice, toFixedDecimal } from '../../../utils/decimal-format';
import { signOf } from '../../../utils/decimal-sign';
import { useWatchlist } from '../../watchlist/hooks/use-watchlist';
import { DashboardCard } from './DashboardCard';

const ROWS = 8;

/**
 * Watchlist snapshot (SCR-08): the first watched pairs in the Trader's
 * order with the live Spot price and 24h change (a Futures-only pair shows
 * a dash, M-09); a row opens the pair's analysis.
 */
export function WatchlistSnapshot({
  pairs,
  tickers,
}: {
  pairs: readonly MarketPair[];
  tickers: ReadonlyMap<string, MarketTicker>;
}) {
  const copy = useCopy();
  const d = copy.dashboard;
  const w = copy.watchlist;
  const m = copy.market;
  const list = useWatchlist();
  const items = list.data?.items.slice(0, ROWS) ?? [];
  return (
    <DashboardCard
      title={d.watchlistTitle}
      link={{ to: '/watchlist', label: d.watchlistMore }}
    >
      {list.isPending ? (
        <Skeleton className="m-4 h-48" />
      ) : list.isError ? (
        <div className="p-4">
          <ErrorState
            message={errorText(copy, list.error)}
            onRetry={() => void list.refetch()}
          />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title={w.empty}
          description={w.emptyHint}
          action={<Link to="/markets">{w.browseMarkets}</Link>}
        />
      ) : (
        <ul>
          {items.map((item) => {
            const pair = pairs.find((each) => each.symbol === item.symbol);
            const ticker = item.spotListed
              ? tickers.get(item.symbol)
              : undefined;
            const change = ticker?.changePercent24h ?? null;
            const down = change !== null && signOf(change) === 'negative';
            const Arrow = down ? ArrowDownRight : ArrowUpRight;
            const market = item.spotListed ? 'spot' : 'futures';
            return (
              <li
                key={item.id}
                className="border-b border-line last:border-b-0"
              >
                <Link
                  to={`/markets/${market}/${item.symbol}`}
                  className={classNames(
                    'flex items-center gap-3 px-4 py-2.5 text-xs no-underline hover:bg-raised-hover',
                    !item.spotListed && !item.futuresListed && 'opacity-50',
                  )}
                >
                  <span className="w-20 shrink-0 font-semibold text-fg-2">
                    {pair?.baseAsset ?? item.symbol}
                    {pair && (
                      <span className="font-normal text-muted-dim">
                        /{pair.quoteAsset ?? ''}
                      </span>
                    )}
                  </span>
                  <span className="flex-1 text-right text-fg">
                    {ticker?.lastPrice ? (
                      <NumericText
                        value={formatPrice(
                          ticker.lastPrice,
                          pair?.tickSize ?? null,
                        )}
                      />
                    ) : (
                      m.noValue
                    )}
                  </span>
                  <span className="inline-flex w-20 items-center justify-end gap-0.5">
                    {change !== null ? (
                      <>
                        <Arrow
                          size={11}
                          aria-hidden="true"
                          className={down ? 'text-negative' : 'text-positive'}
                        />
                        <NumericText
                          signed
                          value={toFixedDecimal(change, 2)}
                          suffix="%"
                        />
                      </>
                    ) : (
                      <span className="text-muted-x">{m.noValue}</span>
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </DashboardCard>
  );
}
