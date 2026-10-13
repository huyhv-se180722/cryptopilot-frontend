import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { Skeleton } from '../../../components/ui/Skeleton';
import { NumericText } from '../../../components/ui/NumericText';
import { useCopy } from '../../../hooks/use-copy';
import { formatCopy } from '../../../i18n/copy';
import { classNames } from '../../../utils/class-names';
import { formatPrice, toFixedDecimal } from '../../../utils/decimal-format';
import type { MarketBoardData } from '../hooks/use-market-board';
import { usePairCandles } from '../hooks/use-market-data';
import { featuredPair } from '../model/market-movers';
import { FreshnessBadge } from './FreshnessBadge';
import { PairChart } from './PairChart';

/**
 * SCR-01 hero card at the radar's bottom left, in place of the
 * prototype's "AI Market Insight" card (a trade setup with entry, TP and
 * SL, which reads as investment advice and needs the Trader-only setup
 * score): BTC/USDT (or the most traded pair) as it is now, its live price,
 * 24h change and 1d chart, and the way to analyse it with an account.
 */
export function HeroMarketCard({
  board,
  className,
}: {
  board: MarketBoardData;
  className?: string;
}) {
  const copy = useCopy();
  const m = copy.market;
  const pair = featuredPair(board.all, board.tickers);
  const ticker = pair ? board.tickers.get(pair.symbol) : undefined;
  const candles = usePairCandles('spot', pair?.symbol ?? null);

  return (
    <section
      aria-label={m.heroCardTitle}
      className={classNames(
        'rounded-2xl border border-line bg-surface/95 p-3.5 shadow-xl shadow-black/10 backdrop-blur dark:shadow-black/50',
        className,
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-mono text-[9px] font-semibold tracking-widest text-muted-dim uppercase">
          {m.heroCardTitle}
        </h2>
        <FreshnessBadge freshness={board.freshness} />
      </div>
      {board.pairs.isPending ? (
        <Skeleton className="h-36" />
      ) : pair ? (
        <>
          <div className="mb-2 flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-bold text-fg">
                {pair.baseAsset ?? pair.symbol}
                <span className="font-normal text-muted-dim">
                  {' '}
                  / {pair.quoteAsset ?? ''}
                </span>
              </p>
              {ticker?.lastPrice && (
                <NumericText
                  className="block text-xl leading-tight font-bold text-fg"
                  value={formatPrice(ticker.lastPrice, pair.tickSize)}
                />
              )}
            </div>
            {ticker?.changePercent24h && (
              <span className="rounded-md bg-raised px-2 py-1">
                <NumericText
                  signed
                  className="text-xs font-bold"
                  value={toFixedDecimal(ticker.changePercent24h, 2)}
                  suffix="%"
                />
              </span>
            )}
          </div>
          {candles.isPending ? (
            <Skeleton className="h-24 w-full" />
          ) : candles.data && candles.data.length > 0 ? (
            <PairChart
              candles={candles.data}
              tickSize={pair.tickSize}
              label={formatCopy(m.chartLabel, { symbol: pair.symbol })}
              className="h-24 w-full"
              lastClose={false}
            />
          ) : (
            <p className="flex h-24 items-center justify-center text-xs text-muted">
              {m.chartEmpty}
            </p>
          )}
          <Link
            to="/register"
            className="mt-3 flex items-center justify-center gap-1.5 rounded-lg border border-primary-line bg-primary-soft py-2 text-[11px] font-semibold text-primary no-underline hover:bg-primary/15"
          >
            {m.heroCardCta}
            <ChevronRight size={11} aria-hidden="true" />
          </Link>
        </>
      ) : null}
    </section>
  );
}
