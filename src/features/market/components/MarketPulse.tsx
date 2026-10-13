import { NumericText } from '../../../components/ui/NumericText';
import { useCopy } from '../../../hooks/use-copy';
import type { MarketPair } from '../../../types/domain';
import { formatPrice, toFixedDecimal } from '../../../utils/decimal-format';
import type { MarketBoardData } from '../hooks/use-market-board';
import { byVolume } from '../model/market-movers';
import { TickerTape } from './TickerTape';

/**
 * SCR-01 strip under the hero (the prototype's live strip and "market
 * pulse"): a ticker tape of every Spot pair's live price, then the four
 * most traded pairs of the last 24 hours. The prototype's tape ran
 * invented "market intelligence" events; this one runs prices.
 */
export function MarketPulse({
  board,
  onSelect,
}: {
  board: MarketBoardData;
  onSelect: (pair: MarketPair) => void;
}) {
  const copy = useCopy();
  const m = copy.market;
  const rows = byVolume(board.all, board.tickers, 4);
  if (rows.length === 0) return null;

  return (
    <section
      aria-label={m.pulseTitle}
      className="mb-8 overflow-hidden rounded-2xl border border-line bg-surface"
    >
      <div className="flex items-center gap-2 border-b border-line px-5 py-2.5">
        <span
          aria-hidden="true"
          className="size-1.5 rounded-full bg-primary motion-safe:animate-[pulse-led_1.8s_ease-in-out_infinite]"
        />
        <span className="font-mono text-[10px] font-bold tracking-widest text-muted-dim uppercase">
          {m.pulseTitle}
        </span>
      </div>
      <TickerTape board={board} />
      <h3 className="px-5 pt-3 text-[10px] font-semibold tracking-wider text-muted-dim uppercase">
        {m.pulseMostTraded}
      </h3>
      <ul className="grid grid-cols-2 gap-2 p-4 pt-2 sm:grid-cols-4">
        {rows.map(({ pair, ticker }) => (
          <li key={pair.symbol}>
            <button
              type="button"
              onClick={() => onSelect(pair)}
              className="w-full rounded-xl border border-line bg-raised px-3 py-2.5 text-left transition-colors hover:border-primary-line hover:bg-raised-hover"
            >
              <span className="mb-1 block text-[11px] font-semibold text-muted-dim">
                {pair.baseAsset ?? pair.symbol}
                <span className="font-normal">/{pair.quoteAsset ?? ''}</span>
              </span>
              {ticker.lastPrice && (
                <NumericText
                  className="mb-0.5 block text-[13px] font-bold text-fg"
                  value={formatPrice(ticker.lastPrice, pair.tickSize)}
                />
              )}
              {ticker.changePercent24h && (
                <NumericText
                  signed
                  className="block text-[10px] font-semibold"
                  value={toFixedDecimal(ticker.changePercent24h, 2)}
                  suffix="%"
                />
              )}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
