import { PageHeader } from '../../components/layout/PageHeader';
import { useCopy } from '../../hooks/use-copy';
import { CoinMarketBoard } from '../../features/market/components/CoinMarketBoard';

/**
 * SCR-09 Market List (SRS 3.3.1, UC-09): every listed coin in one list,
 * Spot and Futures together, with live prices, the market's figures above
 * and search and sort; a coin opens its analysis (SCR-10 / SCR-11), where
 * plan gates apply (SRS 3.3.3).
 */
export function MarketsPage() {
  const copy = useCopy();
  return (
    <div className="w-full">
      <PageHeader
        title={copy.coinMarket.title}
        description={copy.coinMarket.subtitle}
      />
      <CoinMarketBoard />
    </div>
  );
}
