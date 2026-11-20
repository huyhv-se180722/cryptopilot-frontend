import { AlertTriangle } from 'lucide-react';
import { NumericText } from '../../../components/ui/NumericText';
import { useCopy } from '../../../hooks/use-copy';
import { formatCopy } from '../../../i18n/copy';
import type { HealthMarket } from '../../../services/api/market-status';
import { groupThousands } from '../../../utils/decimal-format';
import { formatInstantLocal } from '../../../utils/instant-format';
import {
  isLost,
  useFallbackPrices,
  useMarketHealth,
} from '../hooks/use-market-status';

/**
 * While a market's exchange data is lost (D-159), the pair's display-only
 * reference price with its source and time, and a warning when it is far
 * from the exchange's last price; nothing while the market is live. The
 * label comes from the backend's `source`, never guessed (I7).
 */
export function ReferencePriceNote({
  market,
  symbol,
}: {
  market: HealthMarket;
  symbol: string;
}) {
  const c = useCopy().marketStatus;
  const health = useMarketHealth(market);
  const fallback = useFallbackPrices(market);
  if (!isLost(health)) return null;
  const price =
    fallback?.source === 'OKX'
      ? fallback.prices.find((item) => item.symbol === symbol.toUpperCase())
      : undefined;
  return (
    <div
      data-testid="reference-price"
      className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-warning-line bg-warning-soft px-3 py-1.5 text-xs text-warning"
    >
      {price ? (
        <>
          <span className="font-semibold">{c.referencePrice}</span>
          <NumericText value={groupThousands(price.lastPrice)} />
          <span className="rounded border border-warning-line px-1.5 text-[10px] font-semibold tracking-wide">
            {c.sourceLabel}
          </span>
          {price.asOf && (
            <span className="text-fg-2">
              {formatCopy(c.asOf, { time: formatInstantLocal(price.asOf) })}
            </span>
          )}
          {price.diverged && (
            <span className="inline-flex items-center gap-1">
              <AlertTriangle size={12} aria-hidden="true" />
              {c.diverged}
            </span>
          )}
        </>
      ) : (
        <span>
          {fallback?.source === 'OKX' ? c.noReference : c.referenceNone}
        </span>
      )}
    </div>
  );
}
