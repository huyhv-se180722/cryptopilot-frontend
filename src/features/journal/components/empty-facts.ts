import type { JournalLearning, JournalTrade } from '../../../types/domain';

/**
 * How many facts of a trade the server did not record (SCR-21): the rows
 * `TradeFacts` leaves out until "show all". Leverage is not one of them
 * on Spot, where it does not apply.
 */
export function emptyTradeFacts(trade: JournalTrade): number {
  return [
    trade.entryFee,
    trade.stopLoss,
    trade.takeProfit,
    trade.exitPrice,
    trade.exitTime,
    trade.closeReason,
    trade.realizedPnl,
    trade.feeAmount,
    trade.fundingFeeAmount,
  ].filter((value) => value === null).length;
}

/** The same for the rows of `LearningCard`. */
export function emptyLearningFacts(learning: JournalLearning): number {
  return [
    learning.plannedEntryPrice,
    learning.entryDeviationR,
    learning.entryLiquidity,
    learning.riskAmount,
    learning.analysisTimeframe,
    learning.setupScoreAtPlan ?? learning.setupScoreAtFill,
    learning.rMultiple,
    learning.maeR,
    learning.mfeR,
    learning.maxAdversePrice,
    learning.maxFavorablePrice,
  ].filter((value) => value === null).length;
}
