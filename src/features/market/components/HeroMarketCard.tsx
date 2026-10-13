import { Skeleton } from '../../../components/ui/Skeleton';
import { NumericText } from '../../../components/ui/NumericText';
import { useCopy } from '../../../hooks/use-copy';
import { formatCopy } from '../../../i18n/copy';
import type { MarketPair } from '../../../types/domain';
import { formatPrice, toFixedDecimal } from '../../../utils/decimal-format';
import type { MarketBoardData } from '../hooks/use-market-board';
import { usePairCandles } from '../hooks/use-market-data';
import {
  featuredPair,
  topMovers,
  type PairQuote,
} from '../model/market-movers';
import { FreshnessBadge } from './FreshnessBadge';
import { PairChart } from './PairChart';

/** One mover: a button that opens the pair's chart below. */
function MoverRow({
  row,
  onSelect,
}: {
  row: PairQuote;
  onSelect: (pair: MarketPair) => void;
}) {
  const { pair, ticker } = row;
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(pair)}
        className="flex w-full items-center gap-2 rounded-lg border border-line bg-raised px-2.5 py-2 text-left transition-colors hover:border-primary-line hover:bg-raised-hover pointer-coarse:py-3"
      >
        <span className="text-[11px] font-semibold text-fg">
          {pair.baseAsset ?? pair.symbol}
        </span>
        {ticker.lastPrice && (
          <NumericText
            className="ml-auto text-[11px] text-fg-2"
            value={formatPrice(ticker.lastPrice, pair.tickSize)}
          />
        )}
        <NumericText
          signed
          className="w-14 text-right text-[11px] font-semibold"
          value={toFixedDecimal(ticker.changePercent24h ?? '0', 2)}
          suffix="%"
        />
      </button>
    </li>
  );
}

/**
 * SCR-01 hero panel, in place of the prototype's animated "AI Market
 * Radar" (which showed invented signals): the Spot market as it is, from
 * the backend. BTC/USDT (or the most traded pair) with its live price,
 * 24h change and 1d chart, then the largest 24h rises and falls; a mover
 * opens its basic chart in the list's preview, as a row of the list does.
 */
export function HeroMarketCard({
  board,
  onSelect,
}: {
  board: MarketBoardData;
  onSelect: (pair: MarketPair) => void;
}) {
  const copy = useCopy();
  const m = copy.market;
  const pair = featuredPair(board.all, board.tickers);
  const ticker = pair ? board.tickers.get(pair.symbol) : undefined;
  const candles = usePairCandles('spot', pair?.symbol ?? null);
  const { gainers, losers } = topMovers(board.all, board.tickers, 3);

  return (
    <section
      aria-label={m.heroCardTitle}
      className="overflow-hidden rounded-2xl border border-line bg-surface shadow-lg shadow-black/5 dark:shadow-black/40"
    >
      <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
        <span className="font-mono text-[10px] font-bold tracking-widest text-muted-dim uppercase">
          {m.heroCardTitle}
        </span>
        <span className="ml-auto">
          <FreshnessBadge freshness={board.freshness} />
        </span>
      </div>

      {board.pairs.isPending ? (
        <Skeleton className="m-4 h-56" />
      ) : pair ? (
        <div className="px-4 pt-3">
          <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="text-sm font-semibold text-fg">
              {pair.baseAsset ?? pair.symbol}
              <span className="font-normal text-muted-dim">
                /{pair.quoteAsset ?? ''} · {m.spot}
              </span>
            </h2>
            {ticker?.lastPrice && (
              <NumericText
                className="text-lg font-semibold text-fg"
                value={formatPrice(ticker.lastPrice, pair.tickSize)}
              />
            )}
            {ticker?.changePercent24h && (
              <NumericText
                signed
                className="text-xs"
                value={toFixedDecimal(ticker.changePercent24h, 2)}
                suffix="% 24h"
              />
            )}
          </div>
          {candles.isPending ? (
            <Skeleton className="h-40 w-full" />
          ) : candles.data && candles.data.length > 0 ? (
            <PairChart
              candles={candles.data}
              tickSize={pair.tickSize}
              label={formatCopy(m.chartLabel, { symbol: pair.symbol })}
              className="h-40 w-full"
            />
          ) : (
            <p className="flex h-40 items-center justify-center text-xs text-muted">
              {m.chartEmpty}
            </p>
          )}
        </div>
      ) : null}

      {(gainers.length > 0 || losers.length > 0) && (
        <div className="grid grid-cols-1 gap-3 px-4 py-3 sm:grid-cols-2">
          {[
            { title: m.heroGainers, rows: gainers },
            { title: m.heroLosers, rows: losers },
          ].map((list) => (
            <div key={list.title}>
              <h3 className="mb-1.5 text-[10px] font-semibold tracking-wider text-muted-dim uppercase">
                {list.title}
              </h3>
              <ul className="flex flex-col gap-1.5">
                {list.rows.map((row) => (
                  <MoverRow
                    key={row.pair.symbol}
                    row={row}
                    onSelect={onSelect}
                  />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <p className="border-t border-line px-4 py-2 text-[10px] text-muted-x">
        {m.heroCardNote}
      </p>
    </section>
  );
}
