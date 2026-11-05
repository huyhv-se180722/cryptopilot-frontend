import type { AiQuestion, MarketType, PlanTimeframe } from '../../types/domain';

export const AI_TIMEFRAMES: readonly PlanTimeframe[] = [
  '15m',
  '1h',
  '4h',
  '1d',
];

/**
 * How the Trader asks on SCR-29 (SRS 3.9.1). Each mode sends only its own
 * data: `pair` the analysis of one pair on one market; `mine` one of the
 * Trader's plans (with the analysis of its pair) and/or, on PREMIUM, the
 * performance summary. General questions, with no data at all, are asked
 * from the floating chat.
 */
export type AskMode = 'pair' | 'mine';

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
  mode: 'pair',
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

/** The plan a question carries: only in "mine" mode. */
export function askedPlan(context: AiContextValue): string | null {
  return context.mode === 'mine' && context.planId !== ''
    ? context.planId
    : null;
}

/** Whether the question carries the performance summary: only in "mine" mode. */
export function asksPerformance(context: AiContextValue): boolean {
  return context.mode === 'mine' && context.includePerformance;
}

/** Whether the chosen mode has something to send: "mine" needs a plan or the performance. */
export function isReady(context: AiContextValue): boolean {
  return context.mode === 'pair'
    ? askedPair(context) !== null
    : askedPlan(context) !== null || asksPerformance(context);
}

/**
 * The question as the API takes it, with only the data of the chosen mode.
 * A plan is analysed on its own timeframe, so the timeframe goes only with
 * a pair.
 */
export function toQuestion(text: string, context: AiContextValue): AiQuestion {
  const pairId = askedPair(context);
  const planId = askedPlan(context);
  return {
    question: text,
    ...(pairId !== null
      ? { pairId, market: context.market, timeframe: context.timeframe }
      : {}),
    ...(planId !== null ? { planId } : {}),
    ...(asksPerformance(context) ? { includePerformance: true } : {}),
  };
}
