import type { AiQuestion, MarketType, PlanTimeframe } from '../../types/domain';

export const AI_TIMEFRAMES: readonly PlanTimeframe[] = [
  '15m',
  '1h',
  '4h',
  '1d',
];

/**
 * How the Trader asks: a general question sends no market data, a pair
 * question sends the analysis of one pair on one market (SRS 3.9.1).
 */
export type AskMode = 'general' | 'pair';

/** What the next question is asked about. */
export interface AiContextValue {
  mode: AskMode;
  market: MarketType;
  pairId: string;
  timeframe: PlanTimeframe;
  planId: string;
  includePerformance: boolean;
}

export const NO_CONTEXT: AiContextValue = {
  mode: 'general',
  market: 'spot',
  pairId: '',
  timeframe: '1h',
  planId: '',
  includePerformance: false,
};

/** The pair a question carries: only in pair mode with a pair chosen. */
export function askedPair(context: AiContextValue): string | null {
  return context.mode === 'pair' && context.pairId !== ''
    ? context.pairId
    : null;
}

/**
 * The question as the API takes it. A plan without a pair is analysed on
 * the plan's own timeframe, so the timeframe goes only with a pair.
 */
export function toQuestion(text: string, context: AiContextValue): AiQuestion {
  const pairId = askedPair(context);
  return {
    question: text,
    ...(pairId !== null
      ? { pairId, market: context.market, timeframe: context.timeframe }
      : {}),
    ...(context.planId !== '' ? { planId: context.planId } : {}),
    ...(context.includePerformance ? { includePerformance: true } : {}),
  };
}
