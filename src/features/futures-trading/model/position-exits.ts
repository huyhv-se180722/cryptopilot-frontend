import type { FuturesAlgoOrder, FuturesPosition } from '../../../types/futures';

/**
 * The take profit and stop loss of a position: its waiting conditional
 * orders on the other side that close it (closePosition or reduce-only),
 * of its position side, the first of each kind.
 */
export function exitsOf(
  position: FuturesPosition,
  algo: readonly FuturesAlgoOrder[],
): { takeProfit?: FuturesAlgoOrder; stopLoss?: FuturesAlgoOrder } {
  const long = !position.positionAmt.startsWith('-');
  const closing = algo.filter(
    (order) =>
      order.symbol === position.symbol &&
      order.positionSide === position.positionSide &&
      order.algoStatus === 'NEW' &&
      (order.closePosition || order.reduceOnly) &&
      order.side === (long ? 'SELL' : 'BUY'),
  );
  const takeProfit = closing.find((order) =>
    order.orderType.startsWith('TAKE_PROFIT'),
  );
  const stopLoss = closing.find((order) => order.orderType.startsWith('STOP'));
  return {
    ...(takeProfit ? { takeProfit } : {}),
    ...(stopLoss ? { stopLoss } : {}),
  };
}
