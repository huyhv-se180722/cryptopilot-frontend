import { MessageSquare } from 'lucide-react';
import { EmptyState } from '../../../components/feedback/States';
import { Skeleton } from '../../../components/ui/Skeleton';
import { useCopy } from '../../../hooks/use-copy';
import { formatCopy } from '../../../i18n/copy';
import { useTrendingCoins } from '../hooks/use-community';
import { useCoinPrices } from './coin-prices';

/**
 * Mindshare (D-99): which coins this week's posts talk about, as the share
 * of the coin tags each one holds. Choosing a coin opens its feed.
 */
export function MindsharePanel({
  onSelect,
}: {
  onSelect: (coin: string) => void;
}) {
  const c = useCopy().community;
  const trending = useTrendingCoins();
  const { quotes } = useCoinPrices();
  if (trending.isPending)
    return <Skeleton className="h-72 w-full rounded-2xl" />;
  const coins = trending.data ?? [];
  const total = coins.reduce((sum, coin) => sum + coin.postsLastWeek, 0);
  if (total === 0)
    return <EmptyState icon={MessageSquare} title={c.mindshareEmpty} />;
  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <p className="mb-4 text-xs text-muted-dim">{c.mindshareHint}</p>
      <ol className="grid gap-2">
        {coins.map((coin) => {
          const share = (coin.postsLastWeek / total) * 100;
          const logo = quotes.get(coin.symbol)?.pair.logoUrl;
          return (
            <li key={coin.symbol}>
              <button
                type="button"
                onClick={() => onSelect(coin.symbol)}
                className="grid w-full grid-cols-[90px_minmax(0,1fr)_56px] items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-raised"
              >
                <span className="flex items-center gap-2 text-xs font-semibold text-fg">
                  {logo ? (
                    <img src={logo} alt="" className="size-5 rounded-full" />
                  ) : (
                    <span
                      aria-hidden="true"
                      className="size-2 rounded-full bg-primary"
                    />
                  )}
                  {coin.symbol}
                </span>
                <span
                  className="h-2.5 overflow-hidden rounded-full bg-raised"
                  title={formatCopy(c.railPosts, { n: coin.postsLastWeek })}
                >
                  <span
                    className="block h-full rounded-full bg-linear-to-r from-primary to-accent"
                    style={{ width: Math.max(share, 2) + '%' }}
                  />
                </span>
                <span className="text-right font-mono text-xs text-fg-2">
                  {share.toFixed(1)}%
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
