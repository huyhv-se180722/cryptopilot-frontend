import type {
  ChartLineAction,
  ChartLineDrag,
  ChartPriceLine,
} from '../../chart/components/AnalysisChart';
import type { ChartMarker } from '../../chart/components/chart-markers';
import type { PaperFill, PaperOrder } from '../../../types/domain';
import { decimalPlaces, toFixedDecimal } from '../../../utils/decimal-format';
import { subtract } from '../../../utils/decimal-math';

/**
 * One dashed line per working LIMIT order of the pair (TR-F5, like an
 * exchange chart): green to buy, red to sell, titled with the side and the
 * quantity still open, with the caller's action (cancel) and, where the
 * caller gives one, a handle to drag it to a new price (B4).
 */
export function orderLines(
  orders: readonly PaperOrder[],
  pair: { symbol: string; stepSize: string | null },
  title: (order: PaperOrder, remaining: string) => string,
  action: (order: PaperOrder) => ChartLineAction,
  drag?: (order: PaperOrder) => ChartLineDrag | undefined,
): ChartPriceLine[] {
  const places = decimalPlaces(pair.stepSize);
  return orders.flatMap((order) => {
    const handle = drag?.(order);
    return order.symbol === pair.symbol && order.price !== null
      ? [
          {
            id: order.orderId,
            price: order.price,
            label: title(
              order,
              toFixedDecimal(
                subtract(order.quantity ?? '0', order.executedQuantity),
                places,
              ),
            ),
            tone: order.side === 'BUY' ? 'positive' : 'negative',
            action: action(order),
            ...(handle ? { drag: handle } : {}),
          },
        ]
      : [];
  });
}

/** An arrow per fill of the pair: up under the bar for a buy, down over it for a sell. */
export function fillMarkers(
  fills: readonly PaperFill[],
  symbol: string,
): ChartMarker[] {
  return fills.flatMap((fill) =>
    fill.symbol === symbol
      ? [
          {
            id: fill.fillId,
            time: fill.tradedAt,
            direction: fill.side === 'BUY' ? 'up' : 'down',
            tone: fill.side === 'BUY' ? 'positive' : 'negative',
          },
        ]
      : [],
  );
}
