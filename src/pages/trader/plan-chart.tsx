import { useState } from 'react';
import {
  AnalysisChart,
  type ChartPriceLine,
} from '../../features/chart/components/AnalysisChart';
import type { CandleTimeframe, MarketPair } from '../../types/domain';

/**
 * The chart of a plan's pair on its own market with the plan's lines
 * (SCR-17, SCR-18), on the analysis chart's 1h by default.
 */
export function PlanChart({
  pair,
  lines,
}: {
  pair: MarketPair;
  lines: readonly ChartPriceLine[];
}) {
  const [timeframe, setTimeframe] = useState<CandleTimeframe>('1h');
  return (
    <AnalysisChart
      market={pair.market}
      symbol={pair.symbol}
      tickSize={pair.tickSize}
      timeframe={timeframe}
      onTimeframeChange={setTimeframe}
      priceLines={lines}
    />
  );
}
