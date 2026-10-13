import { useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Activity,
  BookOpen,
  Bot,
  ChevronRight,
  Shield,
  Star,
  type LucideIcon,
} from 'lucide-react';
import { buttonClassName } from '../../components/ui/button-styles';
import { useCopy } from '../../hooks/use-copy';
import { HeroRadar } from '../../features/market/components/HeroRadar';
import { MarketBoard } from '../../features/market/components/MarketBoard';
import { MarketPulse } from '../../features/market/components/MarketPulse';
import { PairPreview } from '../../features/market/components/PairPreview';
import { useMarketBoard } from '../../features/market/hooks/use-market-board';
import type { MarketPair, MarketType } from '../../types/domain';

const marketOf = (value: string | null): MarketType =>
  value === 'futures' ? 'futures' : 'spot';

/**
 * SCR-01 Public Home (SRS 3.3.1): the Figma landing hero, then the Spot /
 * Futures list with live prices and the selected pair's basic 1d chart.
 * The hero keeps the prototype's layout and look with the product's own
 * content: what CryptoPilot does (no "signals"), and on the right its
 * radar drawn from the live Spot market (the day's biggest moves) with
 * two cards of live figures, instead of invented events and a trade
 * setup. The MSG42 disclaimer is in the guest shell footer.
 */
export function PublicHomePage() {
  const copy = useCopy();
  const m = copy.market;
  const [params, setParams] = useSearchParams();
  const market = marketOf(params.get('market'));
  const [selected, setSelected] = useState<MarketPair | null>(null);
  const preview = useRef<HTMLDivElement>(null);
  const markets = useRef<HTMLDivElement>(null);
  const board = useMarketBoard(market);
  // The hero always shows Spot, whichever tab the list is on.
  const spot = useMarketBoard('spot');
  const pair = selected?.market === market ? selected : null;

  const chips: { label: string; icon: LucideIcon; tone: string }[] = [
    { label: m.chipAnalysis, icon: Activity, tone: 'text-primary' },
    { label: m.chipPlans, icon: Shield, tone: 'text-positive' },
    { label: m.chipAlerts, icon: Star, tone: 'text-negative' },
    { label: m.chipJournal, icon: BookOpen, tone: 'text-warning' },
    { label: m.chipAi, icon: Bot, tone: 'text-accent' },
  ];

  const show = (next: MarketPair) => {
    // A pair picked in the hero opens on its own market's tab.
    if (next.market !== market)
      setParams(next.market === 'spot' ? {} : { market: next.market }, {
        replace: true,
      });
    setSelected(next);
    // Stacked below lg: bring the chart into view.
    preview.current?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
  };

  return (
    <div className="mx-auto w-full max-w-7xl">
      <section className="relative isolate mb-6 grid grid-cols-1 items-center gap-10 pt-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)] lg:gap-12 lg:pt-6">
        <div aria-hidden="true" className="hero-ambient" />
        <div className="flex flex-col">
          <p className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-primary-line bg-primary-soft px-4 py-1.5 text-[11px] font-bold tracking-widest text-primary uppercase">
            <span aria-hidden="true" className="text-[10px] text-positive">
              ✦
            </span>
            {m.heroBadge}
          </p>
          <h1 className="mb-5 text-[clamp(34px,4.2vw,60px)] leading-[1.03] font-bold tracking-tight">
            <span className="block text-fg">{m.heroLine1}</span>
            <span className="block bg-linear-90 from-primary to-positive bg-clip-text text-transparent">
              {m.heroLine2}
            </span>
            <span className="block text-fg-2">{m.heroLine3}</span>
          </h1>
          <p className="mb-8 max-w-[440px] text-[clamp(14px,1.1vw,17px)] leading-relaxed text-muted">
            {m.heroBody}
          </p>
          <div className="mb-8 flex flex-wrap items-center gap-3">
            <Link
              to="/register"
              className={buttonClassName(
                'primary',
                'lg',
                'no-underline shadow-lg shadow-primary/25',
              )}
            >
              {m.heroRegister}
              <ChevronRight size={15} aria-hidden="true" />
            </Link>
            <button
              type="button"
              onClick={() =>
                markets.current?.scrollIntoView?.({
                  behavior: 'smooth',
                  block: 'start',
                })
              }
              className={buttonClassName('secondary', 'lg')}
            >
              {m.heroExplore}
            </button>
          </div>
          <ul aria-label={m.heroChipsLabel} className="flex flex-wrap gap-2">
            {chips.map(({ label, icon: Icon, tone }) => (
              <li
                key={label}
                className="flex items-center gap-1.5 rounded-lg border border-line bg-raised px-2.5 py-1.5 text-[11px] font-medium text-muted"
              >
                <Icon size={11} aria-hidden="true" className={tone} />
                {label}
              </li>
            ))}
          </ul>
        </div>
        <HeroRadar board={spot} onSelect={show} />
      </section>

      <MarketPulse board={spot} onSelect={show} />

      <div
        ref={markets}
        className="grid scroll-mt-20 grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start"
      >
        <MarketBoard
          board={board}
          onMarketChange={(next) => {
            setParams(next === 'spot' ? {} : { market: next }, {
              replace: true,
            });
          }}
          selectedSymbol={pair?.symbol ?? null}
          onSelect={show}
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
