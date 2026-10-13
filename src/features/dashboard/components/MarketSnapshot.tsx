import { useState } from 'react';
import { ErrorState } from '../../../components/feedback/States';
import { NumericText } from '../../../components/ui/NumericText';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { Skeleton } from '../../../components/ui/Skeleton';
import { useCopy } from '../../../hooks/use-copy';
import { formatCopy } from '../../../i18n/copy';
import { errorText } from '../../../i18n/messages';
import type { MarketPair, MarketTicker } from '../../../types/domain';
import { formatPrice, toFixedDecimal } from '../../../utils/decimal-format';
import { PairChart } from '../../market/components/PairChart';
import { usePairCandles } from '../../market/hooks/use-market-data';
import { DashboardCard } from './DashboardCard';

/** The first Spot pairs in the administrator's display order. */
const FEATURED = 4;

/**
 * Figma "Market snapshot": a few Spot pairs to switch between, the live
 * price and 24h change, and the pair's daily chart (last 90 closed days),
 * with a link to its analysis (SCR-10).
 */
export function MarketSnapshot({
  pairs,
  tickers,
}: {
  pairs: readonly MarketPair[];
  tickers: ReadonlyMap<string, MarketTicker>;
}) {
  const copy = useCopy();
  const d = copy.dashboard;
  const m = copy.market;
  const featured = pairs.slice(0, FEATURED);
  const [symbol, setSymbol] = useState(featured[0]?.symbol ?? '');
  const pair = featured.find((each) => each.symbol === symbol) ?? featured[0];
  const candles = usePairCandles('spot', pair?.symbol ?? null);
  const ticker = pair ? tickers.get(pair.symbol) : undefined;
  if (!pair) return null;
  return (
    <DashboardCard
      title={d.snapshotTitle}
      link={{ to: `/markets/spot/${pair.symbol}`, label: d.openAnalysis }}
      actions={
        <SegmentedControl
          label={d.snapshotPairs}
          value={pair.symbol}
          onChange={setSymbol}
          options={featured.map((each) => ({
            value: each.symbol,
            label: `${each.baseAsset ?? each.symbol}/${each.quoteAsset ?? ''}`,
          }))}
        />
      }
    >
      <div className="p-4">
        <div className="mb-3 flex items-baseline gap-2">
          {ticker?.lastPrice ? (
            <NumericText
              className="text-base font-semibold text-fg"
              value={formatPrice(ticker.lastPrice, pair.tickSize)}
            />
          ) : (
            <span className="text-muted-x">{m.noValue}</span>
          )}
          {ticker?.changePercent24h && (
            <span className="text-xs">
              <NumericText
                signed
                value={toFixedDecimal(ticker.changePercent24h, 2)}
                suffix="%"
              />{' '}
              <span className="text-muted-x">24h</span>
            </span>
          )}
        </div>
        {candles.isPending ? (
          <Skeleton className="h-64 w-full" />
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
            label={formatCopy(m.chartLabel, { symbol: pair.symbol })}
          />
        )}
      </div>
    </DashboardCard>
  );
}
