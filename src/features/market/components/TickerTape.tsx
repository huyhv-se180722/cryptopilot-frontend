import { useState, type CSSProperties } from 'react';
import { Pause, Play } from 'lucide-react';
import { NumericText } from '../../../components/ui/NumericText';
import { useCopy } from '../../../hooks/use-copy';
import { classNames } from '../../../utils/class-names';
import { formatPrice, toFixedDecimal } from '../../../utils/decimal-format';
import type { MarketBoardData } from '../hooks/use-market-board';

/** Seconds each pair takes to cross, so the speed stays even. */
const SECONDS_PER_PAIR = 4;

/**
 * SCR-01 running strip of the market pulse, as an exchange's ticker
 * tape: every enabled Spot
 * pair with its live price and 24h change, scrolling without end. Prices
 * change in place each second without restarting the run. The prototype's
 * strip ran invented events ("breakout detected"); this one runs prices.
 */
export function TickerTape({
  board,
  label,
  className,
}: {
  board: MarketBoardData;
  /** A live title before the tape (its section's name). */
  label?: string;
  className?: string;
}) {
  const copy = useCopy();
  const m = copy.market;
  const [paused, setPaused] = useState(false);
  // In the Admin's display order, as the list starts (SRS 3.3.1).
  const ordered = [...board.all].sort(
    (a, b) => a.displayOrder - b.displayOrder,
  );
  const rows = ordered.flatMap((pair) => {
    const ticker = board.tickers.get(pair.symbol);
    return ticker?.lastPrice ? [{ pair, ticker, price: ticker.lastPrice }] : [];
  });
  if (rows.length === 0) return null;

  const list = (copyOf: boolean) => (
    <ul
      aria-hidden={copyOf || undefined}
      className={
        'flex shrink-0 items-center gap-8 pr-8' +
        (copyOf ? ' ticker-tape-copy' : '')
      }
    >
      {rows.map(({ pair, ticker, price }) => (
        <li
          key={pair.symbol}
          className="flex items-center gap-2 text-[11px] whitespace-nowrap"
        >
          <span className="font-semibold text-fg-2">
            {pair.baseAsset ?? pair.symbol}
            <span className="font-normal text-muted-dim">
              /{pair.quoteAsset ?? ''}
            </span>
          </span>
          <NumericText
            className="text-fg"
            value={formatPrice(price, pair.tickSize)}
          />
          {ticker.changePercent24h && (
            <NumericText
              signed
              className="font-semibold"
              value={toFixedDecimal(ticker.changePercent24h, 2)}
              suffix="%"
            />
          )}
        </li>
      ))}
    </ul>
  );

  return (
    <div
      className={classNames(
        'flex items-center gap-2 py-2 pr-3 pl-5',
        className,
      )}
    >
      {label && (
        <span className="flex shrink-0 items-center gap-1.5 border-r border-line pr-3 font-mono text-[10px] font-bold tracking-widest text-muted-dim uppercase">
          <span
            aria-hidden="true"
            className="size-1.5 rounded-full bg-primary motion-safe:animate-[pulse-led_1.8s_ease-in-out_infinite]"
          />
          <span className="hidden sm:inline">{label}</span>
        </span>
      )}
      <div
        role="region"
        aria-label={m.tapeLabel}
        data-paused={paused}
        className="ticker-tape min-w-0 flex-1"
        style={
          {
            '--tape-duration': `${rows.length * SECONDS_PER_PAIR}s`,
          } as CSSProperties
        }
      >
        <div className="ticker-tape-track">
          {list(false)}
          {list(true)}
        </div>
      </div>
      <button
        type="button"
        aria-pressed={paused}
        aria-label={paused ? m.tapePlay : m.tapePause}
        title={paused ? m.tapePlay : m.tapePause}
        onClick={() => setPaused((was) => !was)}
        className="inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-line text-muted hover:text-fg pointer-coarse:size-9"
      >
        {paused ? (
          <Play size={12} aria-hidden="true" />
        ) : (
          <Pause size={12} aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
