import { Link } from 'react-router-dom';
import { LineChart } from 'lucide-react';
import { ErrorState } from '../../../components/feedback/States';
import { NumericText } from '../../../components/ui/NumericText';
import { Skeleton } from '../../../components/ui/Skeleton';
import { buttonClassName } from '../../../components/ui/button-styles';
import { useCopy } from '../../../hooks/use-copy';
import { formatCopy } from '../../../i18n/copy';
import { errorText } from '../../../i18n/messages';
import type { MarketPair, MarketTicker } from '../../../types/domain';
import { formatPrice, toFixedDecimal } from '../../../utils/decimal-format';
import { usePairCandles } from '../hooks/use-market-data';
import { PairChart } from './PairChart';

/**
 * SCR-01 side panel: the selected pair's basic 1d chart and the invitation
 * to register for the full analysis (SRS 3.3.1). No indicators here.
 */
export function PairPreview({
  pair,
  ticker,
}: {
  pair: MarketPair | null;
  ticker: MarketTicker | undefined;
}) {
  const copy = useCopy();
  const m = copy.market;
  const candles = usePairCandles(pair?.market ?? 'spot', pair?.symbol ?? null);

  if (!pair)
    return (
      <div className="flex h-full min-h-48 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-line bg-surface p-6 text-center">
        <LineChart size={20} aria-hidden="true" className="text-muted-dim" />
        <p className="text-xs text-muted">{m.previewPrompt}</p>
      </div>
    );

  const price = pair.market === 'spot' ? ticker?.lastPrice : ticker?.markPrice;
  const label = formatCopy(m.chartLabel, { symbol: pair.symbol });

  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-fg">
          {pair.baseAsset ?? pair.symbol}
          <span className="font-normal text-muted-dim">
            /{pair.quoteAsset ?? ''} · 1D
          </span>
        </h2>
        <span className="flex items-baseline gap-2 text-sm">
          {price && <NumericText value={formatPrice(price, pair.tickSize)} />}
          {pair.market === 'spot' && ticker?.changePercent24h && (
            <NumericText
              signed
              className="text-xs"
              value={toFixedDecimal(ticker.changePercent24h, 2)}
              suffix="%"
            />
          )}
        </span>
      </div>
      {candles.isPending ? (
        <Skeleton className="h-64 w-full sm:h-72" />
      ) : candles.isError ? (
        <ErrorState
          message={errorText(copy, candles.error)}
          onRetry={() => void candles.refetch()}
        />
      ) : candles.data.length === 0 ? (
        <p className="flex h-64 items-center justify-center text-xs text-muted">
          {m.chartEmpty}
        </p>
      ) : (
        <PairChart
          candles={candles.data}
          tickSize={pair.tickSize}
          label={label}
        />
      )}
      <div className="mt-4 flex flex-col gap-2">
        <Link
          to="/register"
          className={buttonClassName('primary', 'md', 'w-full no-underline')}
        >
          {m.previewRegister}
        </Link>
        <Link
          to="/login"
          className={buttonClassName('secondary', 'md', 'w-full no-underline')}
        >
          {m.previewSignIn}
        </Link>
      </div>
    </div>
  );
}
