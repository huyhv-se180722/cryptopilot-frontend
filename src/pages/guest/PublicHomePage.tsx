import { useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { buttonClassName } from '../../components/ui/button-styles';
import { useCopy } from '../../hooks/use-copy';
import { MarketBoard } from '../../features/market/components/MarketBoard';
import { PairPreview } from '../../features/market/components/PairPreview';
import { useMarketBoard } from '../../features/market/hooks/use-market-board';
import type { MarketPair, MarketType } from '../../types/domain';

const marketOf = (value: string | null): MarketType =>
  value === 'futures' ? 'futures' : 'spot';

/**
 * SCR-01 Public Home (SRS 3.3.1): a short Figma hero, then the Spot /
 * Futures list with live prices and the selected pair's basic 1d chart.
 * The MSG42 disclaimer is in the guest shell footer (BR-60).
 */
export function PublicHomePage() {
  const copy = useCopy();
  const m = copy.market;
  const [params, setParams] = useSearchParams();
  const market = marketOf(params.get('market'));
  const [selected, setSelected] = useState<MarketPair | null>(null);
  const preview = useRef<HTMLDivElement>(null);
  const board = useMarketBoard(market);
  const pair = selected?.market === market ? selected : null;

  return (
    <div className="mx-auto w-full max-w-7xl">
      <section className="mb-8 max-w-2xl">
        <h1 className="mb-4 text-[clamp(30px,4vw,48px)] leading-[1.05] font-bold tracking-tight">
          <span className="block text-fg">{m.heroLine1}</span>
          <span className="block bg-linear-90 from-primary to-positive bg-clip-text text-transparent">
            {m.heroLine2}
          </span>
          <span className="block text-fg-2">{m.heroLine3}</span>
        </h1>
        <p className="mb-6 max-w-md text-sm leading-relaxed text-muted">
          {m.heroBody}
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/register"
            className={buttonClassName('primary', 'lg', 'no-underline')}
          >
            {m.heroRegister}
            <ChevronRight size={15} aria-hidden="true" />
          </Link>
          <Link
            to="/login"
            className={buttonClassName('secondary', 'lg', 'no-underline')}
          >
            {m.heroSignIn}
          </Link>
        </div>
      </section>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <MarketBoard
          board={board}
          onMarketChange={(next) => {
            setParams(next === 'spot' ? {} : { market: next }, {
              replace: true,
            });
          }}
          selectedSymbol={pair?.symbol ?? null}
          onSelect={(next) => {
            setSelected(next);
            // Stacked below lg: bring the chart into view.
            preview.current?.scrollIntoView?.({
              behavior: 'smooth',
              block: 'nearest',
            });
          }}
        />
        <div ref={preview} className="lg:sticky lg:top-20">
          <PairPreview
            pair={pair}
            ticker={pair ? board.tickers.get(pair.symbol) : undefined}
          />
        </div>
      </div>
    </div>
  );
}
