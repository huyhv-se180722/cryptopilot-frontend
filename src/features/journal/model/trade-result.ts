import type { JournalTrade } from '../../../types/domain';
import { compare } from '../../../utils/decimal-math';

export type TradeResult = 'WIN' | 'LOSS' | 'BREAKEVEN';

/** BR-42: by the sign of the net P/L; an open trade has no result yet. */
export function tradeResult(trade: JournalTrade): TradeResult | null {
  if (trade.status !== 'CLOSED' || trade.netPnl === null) return null;
  const sign = compare(trade.netPnl, '0');
  return sign > 0 ? 'WIN' : sign < 0 ? 'LOSS' : 'BREAKEVEN';
}
