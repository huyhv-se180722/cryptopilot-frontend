import { CircleDot, Info, Sparkles } from 'lucide-react';
import { CoinLogo } from '../../../../components/ui/CoinLogo';
import { Skeleton } from '../../../../components/ui/Skeleton';
import { useCopy } from '../../../../hooks/use-copy';
import { formatCopy } from '../../../../i18n/copy';
import type { MemberProfile, TokenMention } from '../../../../types/domain';
import { classNames } from '../../../../utils/class-names';
import { formatPrice, toFixedDecimal } from '../../../../utils/decimal-format';
import { useTokenMentions } from '../../hooks/use-community';
import { useCoinPrices } from '../coin-prices';
import { Stance } from '../CommunityAside';
import { formatScore } from '../post-format';

const panel = 'rounded-2xl border border-line bg-surface';

/**
 * Social Insights (D-99, D-125): the member's Social Influence and
 * Analytical Depth, the scores Top Influencers ranks by, each with what it
 * weighs. "--" until they publish, as CoinMarketCap shows a new member.
 */
export function SocialInsightsCard({ profile }: { profile: MemberProfile }) {
  const m = useCopy().community.member;
  const published = profile.posts > 0;
  const scores = [
    {
      label: m.influence,
      hint: m.influenceHint,
      value: profile.influenceScore,
    },
    { label: m.depth, hint: m.depthHint, value: profile.depthScore },
  ];
  return (
    <section className={panel} aria-labelledby="member-insights">
      <h2
        id="member-insights"
        className="flex items-center gap-1.5 px-4 pt-4 text-sm font-semibold text-fg"
      >
        <Sparkles size={14} aria-hidden="true" className="text-primary" />
        {m.insightsTitle}
      </h2>
      <dl className="grid grid-cols-2 gap-3 px-4 pt-3 pb-4">
        {scores.map((score) => (
          <div key={score.label} className="min-w-0">
            <dt className="flex items-center gap-1 text-xs text-muted-x">
              <span className="truncate">{score.label}</span>
              <span title={score.hint} className="shrink-0">
                <Info size={11} aria-label={score.hint} />
              </span>
            </dt>
            <dd className="mt-1 font-mono text-xl font-bold text-fg">
              {published ? formatScore(score.value) : '--'}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/**
 * Token Mentions (D-99): the coins the member's posts talk about, with
 * their share of the member's mentions (mindshare), the live price and
 * 24h change, and the member's own lean on the coin from the stances of
 * their posts.
 */
export function TokenMentionsCard({ memberId }: { memberId: string }) {
  const m = useCopy().community.member;
  const mentions = useTokenMentions(memberId);
  const rows = mentions.data ?? [];
  return (
    <section className={panel} aria-labelledby="member-mentions">
      <h2
        id="member-mentions"
        className="flex items-center gap-1.5 px-4 pt-4 text-sm font-semibold text-fg"
      >
        <CircleDot size={14} aria-hidden="true" className="text-primary" />
        {m.mentionsTitle}
        <span title={m.mentionsHint} className="text-muted-x">
          <Info size={12} aria-label={m.mentionsHint} />
        </span>
      </h2>
      <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto_64px] gap-2 border-y border-line px-4 py-1.5 text-xs text-muted-x">
        <span>{m.mindshare}</span>
        <span className="text-right">{m.price}</span>
        <span className="text-right">{m.lean}</span>
      </div>
      <ol className="pb-1">
        {mentions.isPending ? (
          [0, 1, 2].map((n) => (
            <li key={n} className="px-4 py-2">
              <Skeleton className="h-9 w-full" />
            </li>
          ))
        ) : rows.length === 0 ? (
          <li className="px-4 py-6 text-center text-xs text-muted-dim">
            {m.mentionsEmpty}
          </li>
        ) : (
          rows.map((mention) => (
            <li key={mention.symbol}>
              <MentionRow mention={mention} />
            </li>
          ))
        )}
      </ol>
    </section>
  );
}

function MentionRow({ mention }: { mention: TokenMention }) {
  const m = useCopy().community.member;
  const quote = useCoinPrices().quotes.get(mention.symbol);
  const ticker = quote?.ticker;
  const change = ticker?.changePercent24h ?? null;
  const up = change !== null && !change.startsWith('-');
  return (
    <div
      aria-label={formatCopy(m.mentionLabel, {
        coin: mention.symbol,
        share: String(mention.sharePercent),
        n: mention.posts,
        bull: mention.bullishPosts,
        bear: mention.bearishPosts,
      })}
      className="grid grid-cols-[minmax(0,1fr)_auto_64px] items-center gap-2 border-t border-line px-4 py-2.5 first:border-t-0"
    >
      <div className="flex min-w-0 items-center gap-2">
        <CoinLogo src={quote?.pair.logoUrl} symbol={mention.symbol} size="sm" />
        <div className="min-w-0">
          <span className="block truncate text-xs font-semibold text-fg">
            {mention.symbol}
          </span>
          <span className="flex items-center gap-1.5 text-xs text-muted-x">
            <span
              aria-hidden="true"
              className="h-1 w-10 overflow-hidden rounded-full bg-raised"
            >
              <span
                className="block h-full rounded-full bg-primary"
                style={{ width: Math.min(mention.sharePercent, 100) + '%' }}
              />
            </span>
            {mention.sharePercent.toFixed(1)}%
          </span>
        </div>
      </div>
      <div className="text-right">
        <span className="block font-mono text-xs text-fg">
          {ticker?.lastPrice && quote
            ? '$' + formatPrice(ticker.lastPrice, quote.pair.tickSize)
            : '—'}
        </span>
        {change !== null && (
          <span
            className={classNames(
              'block font-mono text-xs',
              up ? 'text-positive' : 'text-negative',
            )}
          >
            {up ? '▲' : '▼'} {toFixedDecimal(change.replace(/^-/, ''), 2)}%
          </span>
        )}
      </div>
      <Stance bullish={mention.bullishPosts} bearish={mention.bearishPosts} />
    </div>
  );
}
