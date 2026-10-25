import { Link } from 'react-router-dom';
import { Hash } from 'lucide-react';
import { EmptyState, ErrorState } from '../../components/feedback/States';
import { Skeleton } from '../../components/ui/Skeleton';
import { useCoinPrices } from '../../features/community/components/coin-prices';
import { CommunityFrame } from '../../features/community/components/CommunityFrame';
import { postAge } from '../../features/community/components/post-format';
import { usePostInteractions } from '../../features/community/components/use-post-interactions';
import { useTrendingCoins } from '../../features/community/hooks/use-community';
import { useCopy } from '../../hooks/use-copy';
import { formatCopy } from '../../i18n/copy';
import { errorText } from '../../i18n/messages';
import type { CoinDiscussion } from '../../types/domain';
import { classNames } from '../../utils/class-names';
import { formatPrice, toFixedDecimal } from '../../utils/decimal-format';

/**
 * Topics (D-99): CoinMarketCap Community's topics are what the posts talk
 * about; here, the coins this week's posts tag, each opening its feed.
 */
export function CommunityTopicsPage() {
  const actions = usePostInteractions();
  return <CommunityFrame actions={actions}>{() => <Topics />}</CommunityFrame>;
}

function Topics() {
  const copy = useCopy();
  const c = copy.community;
  const trending = useTrendingCoins();
  const coins = trending.data ?? [];
  return (
    <>
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight text-fg">
          {c.topicsTitle}
        </h1>
        <p className="mt-1 text-xs text-muted-dim">{c.topicsSubtitle}</p>
      </div>
      {trending.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
          {[0, 1, 2, 3].map((n) => (
            <Skeleton key={n} className="h-36 w-full rounded-2xl" />
          ))}
        </div>
      ) : trending.isError ? (
        <ErrorState
          message={errorText(copy, trending.error)}
          onRetry={() => void trending.refetch()}
        />
      ) : coins.length === 0 ? (
        <EmptyState icon={Hash} title={c.topicsEmpty} />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
          {coins.map((coin, index) => (
            <li key={coin.symbol}>
              <TopicCard coin={coin} rank={index + 1} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function TopicCard({ coin, rank }: { coin: CoinDiscussion; rank: number }) {
  const copy = useCopy();
  const c = copy.community;
  const quote = useCoinPrices().quotes.get(coin.symbol);
  const change = quote?.ticker?.changePercent24h ?? null;
  const up = change !== null && !change.startsWith('-');
  return (
    <Link
      to={'/community?coin=' + encodeURIComponent(coin.symbol)}
      aria-label={formatCopy(c.topicsOpen, { coin: coin.symbol })}
      className="block rounded-2xl border border-line bg-surface p-4 no-underline transition-colors duration-150 hover:border-line-strong"
    >
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-x">#{rank}</span>
        {quote?.pair.logoUrl ? (
          <img
            src={quote.pair.logoUrl}
            alt=""
            className="size-8 rounded-full"
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex size-8 items-center justify-center rounded-full bg-raised text-[10px] font-bold text-fg-2"
          >
            {coin.symbol.slice(0, 3)}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-fg">
            ${coin.symbol}
          </p>
          <p className="truncate text-[11px] text-muted-dim">{coin.name}</p>
        </div>
        <div className="text-right">
          {quote?.ticker?.lastPrice && (
            <p className="font-mono text-xs text-fg">
              ${formatPrice(quote.ticker.lastPrice, quote.pair.tickSize)}
            </p>
          )}
          {change !== null && (
            <p
              className={classNames(
                'font-mono text-[11px]',
                up ? 'text-positive' : 'text-negative',
              )}
            >
              {up ? '▲' : '▼'} {toFixedDecimal(change.replace(/^-/, ''), 2)}%
            </p>
          )}
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-raised px-2 py-1.5">
          <dt className="text-[10px] text-muted-x">{c.discussionDay}</dt>
          <dd className="font-mono text-sm font-semibold text-fg">
            {coin.postsLastDay}
          </dd>
        </div>
        <div className="rounded-lg bg-raised px-2 py-1.5">
          <dt className="text-[10px] text-muted-x">{c.discussionWeek}</dt>
          <dd className="font-mono text-sm font-semibold text-fg">
            {coin.postsLastWeek}
          </dd>
        </div>
        <div className="rounded-lg bg-raised px-2 py-1.5">
          <dt className="text-[10px] text-muted-x">{c.discussionLast}</dt>
          <dd className="truncate text-xs font-semibold text-fg">
            {coin.lastPostAt ? postAge(copy, coin.lastPostAt) : '—'}
          </dd>
        </div>
      </dl>
    </Link>
  );
}
