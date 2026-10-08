import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../components/layout/PageHeader';
import { useCopy } from '../../hooks/use-copy';
import { MarketBoard } from '../../features/market/components/MarketBoard';
import { useMarketBoard } from '../../features/market/hooks/use-market-board';
import type { MarketType } from '../../types/domain';

/**
 * SCR-09 Market List (SRS 3.3.1, UC-09): Spot and Futures tabs with live
 * prices, search and sort; a pair opens its analysis (SCR-10 / SCR-11),
 * where plan gates apply (SRS 3.3.3).
 */
export function MarketsPage() {
  const copy = useCopy();
  const [params, setParams] = useSearchParams();
  const market: MarketType =
    params.get('market') === 'futures' ? 'futures' : 'spot';
  const board = useMarketBoard(market);
  return (
    <div className="mx-auto w-full max-w-7xl">
      <PageHeader
        title={copy.screens.markets}
        description={copy.market.marketsSubtitle}
      />
      <MarketBoard
        board={board}
        onMarketChange={(next) =>
          setParams(next === 'spot' ? {} : { market: next }, { replace: true })
        }
        hrefOf={(pair) => `/markets/${pair.market}/${pair.symbol}`}
      />
    </div>
  );
}
