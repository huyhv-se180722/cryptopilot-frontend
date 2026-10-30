import { useMemo } from 'react';
import type { ChartPriceLine } from '../../chart/components/AnalysisChart';
import { useCopy } from '../../../hooks/use-copy';
import { useToast } from '../../../hooks/use-toast';
import { formatCopy } from '../../../i18n/copy';
import type { MarketPair } from '../../../types/domain';
import type { FuturesPosition } from '../../../types/futures';
import { groupThousands } from '../../../utils/decimal-format';
import { subtract } from '../../../utils/decimal-math';
import {
  useFuturesActions,
  useFuturesOpenAlgoOrders,
  useFuturesOpenOrders,
} from './use-futures';
import { futuresErrorText } from '../model/futures-errors';

const isZero = (value: string | null) => !value || /^0(\.0+)?$/.test(value);

/**
 * The lines of the pair on the Futures chart (TR-F5b, as the exchange's
 * chart): each position's entry and liquidation price, each working LIMIT
 * order with a cancel button, and each conditional order's trigger.
 */
export function useFuturesChartLines(
  pair: MarketPair,
  positions: readonly FuturesPosition[] | undefined,
) {
  const copy = useCopy();
  const f = copy.futures;
  const toast = useToast();
  const orders = useFuturesOpenOrders(pair.symbol);
  const algo = useFuturesOpenAlgoOrders(pair.symbol);
  const { cancel, cancelAlgo } = useFuturesActions();
  const cancelRun = cancel.run;
  const cancelAlgoRun = cancelAlgo.run;

  const lines = useMemo(() => {
    const out: ChartPriceLine[] = [];
    for (const position of positions ?? []) {
      if (position.symbol !== pair.symbol) continue;
      const long = !position.positionAmt.startsWith('-');
      const size = groupThousands(position.positionAmt.replace('-', ''));
      out.push({
        id: 'entry-' + position.positionSide,
        price: position.entryPrice,
        label: formatCopy(long ? f.lineEntryLong : f.lineEntryShort, { size }),
        tone: long ? 'positive' : 'negative',
      });
      if (!isZero(position.liquidationPrice))
        out.push({
          id: 'liq-' + position.positionSide,
          price: position.liquidationPrice,
          label: f.lineLiq,
          tone: 'warning',
          dashed: true,
        });
    }
    for (const order of orders.data ?? []) {
      if (order.symbol !== pair.symbol || order.type !== 'LIMIT') continue;
      out.push({
        id: order.orderId,
        price: order.price,
        label: formatCopy(f.lineOrder, {
          side: order.side === 'BUY' ? f.buy : f.sell,
          size: groupThousands(subtract(order.origQty, order.executedQty)),
        }),
        tone: order.side === 'BUY' ? 'positive' : 'negative',
        dashed: true,
        action: {
          label: f.cancel,
          onSelect: () =>
            void cancelRun(order.symbol, order.orderId).then((result) => {
              if (result.status === 'error')
                toast.show({
                  tone: 'error',
                  message: futuresErrorText(copy, result.error),
                });
            }),
        },
      });
    }
    for (const order of algo.data ?? []) {
      if (order.symbol !== pair.symbol || !order.triggerPrice) continue;
      const takeProfit = order.orderType.startsWith('TAKE_PROFIT');
      out.push({
        id: order.algoId,
        price: order.triggerPrice,
        label: takeProfit ? f.lineTakeProfit : f.lineStopLoss,
        tone: takeProfit ? 'positive' : 'negative',
        dashed: true,
        action: {
          label: f.cancel,
          onSelect: () =>
            void cancelAlgoRun(order.symbol, order.algoId).then((result) => {
              if (result.status === 'error')
                toast.show({
                  tone: 'error',
                  message: futuresErrorText(copy, result.error),
                });
            }),
        },
      });
    }
    return out;
  }, [
    positions,
    orders.data,
    algo.data,
    pair.symbol,
    f,
    copy,
    toast,
    cancelRun,
    cancelAlgoRun,
  ]);
  return { lines };
}
