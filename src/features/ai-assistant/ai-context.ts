import type { MarketType, PlanTimeframe } from '../../types/domain';

export const AI_TIMEFRAMES: readonly PlanTimeframe[] = [
  '15m',
  '1h',
  '4h',
  '1d',
];

/** What the next question is asked about. */
export interface AiContextValue {
  market: MarketType;
  pairId: string;
  timeframe: PlanTimeframe;
  planId: string;
  includePerformance: boolean;
}

export const NO_CONTEXT: AiContextValue = {
  market: 'spot',
  pairId: '',
  timeframe: '1h',
  planId: '',
  includePerformance: false,
};
