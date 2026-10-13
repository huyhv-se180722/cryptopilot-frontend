import { useCopy } from '../../../hooks/use-copy';
import { formatCopy } from '../../../i18n/copy';
import type { MarketPair } from '../../../types/domain';
import { classNames } from '../../../utils/class-names';
import type { MarketBoardData } from '../hooks/use-market-board';
import { breadth, radarPoints, topMovers } from '../model/market-movers';
import { HeroMarketCard } from './HeroMarketCard';
import { MarketBreadthCard } from './MarketBreadthCard';
import { MarketRadar } from './MarketRadar';

const FEED_DOT = {
  live: 'bg-positive motion-safe:animate-[pulse-led_2s_ease-in-out_infinite]',
  delayed: 'bg-warning',
  connecting: 'bg-muted',
} as const;

/**
 * SCR-01 right half of the hero, the prototype's radar composition: a
 * status line, the radar of the day's biggest moves, and two cards laid
 * over its corners on wide screens (stacked under it on narrow ones).
 * Every number comes from the live Spot tickers.
 */
export function HeroRadar({
  board,
  onSelect,
}: {
  board: MarketBoardData;
  onSelect: (pair: MarketPair) => void;
}) {
  const copy = useCopy();
  const m = copy.market;
  const { gainers, losers } = topMovers(board.all, board.tickers, 3);
  const feed = {
    live: m.radarFeedLive,
    delayed: m.radarFeedDelayed,
    connecting: m.radarFeedConnecting,
  }[board.freshness];

  return (
    <section aria-label={m.radarLabel} className="min-w-0">
      <div className="mb-3 flex items-center justify-between gap-3 px-1 font-mono text-[10px] tracking-wider text-muted-dim uppercase">
        <span>{formatCopy(m.radarMonitored, { count: board.all.length })}</span>
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className={classNames(
              'size-1.5 rounded-full',
              FEED_DOT[board.freshness],
            )}
          />
          {feed}
        </span>
      </div>
      <div className="relative">
        <MarketRadar
          points={radarPoints(gainers, losers)}
          onSelect={onSelect}
        />
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:contents">
          <HeroMarketCard
            board={board}
            className="lg:absolute lg:bottom-0 lg:left-0 lg:z-10 lg:w-60"
          />
          <MarketBreadthCard
            breadth={breadth(board.all, board.tickers)}
            className="sm:self-start lg:absolute lg:top-4 lg:right-0 lg:z-10 lg:w-48"
          />
        </div>
      </div>
      <p className="mt-3 text-center text-[11px] text-muted-dim">
        {m.radarLegend}
      </p>
    </section>
  );
}
