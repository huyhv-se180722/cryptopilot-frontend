import { useCallback, useState } from 'react';
import type {
  ChartExtraItem,
  ChartPriceLine,
} from '../../chart/components/AnalysisChart';
import type { ChartMarker } from '../../chart/components/chart-markers';
import { useCopy } from '../../../hooks/use-copy';
import { useToast } from '../../../hooks/use-toast';
import { formatCopy } from '../../../i18n/copy';
import type { MarketPair } from '../../../types/domain';
import { fillMarkers, orderLines } from '../model/chart-orders';
import { paperErrorText } from '../model/paper-errors';
import {
  useFillHistory,
  useOpenOrders,
  usePaperActions,
} from './use-paper-orders';

const STORAGE_KEY = 'cp-trade-chart-orders';

function read(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== 'false';
  } catch {
    return true;
  }
}

/**
 * The Trader's demo orders on the trading chart (TR-F5, Spot part): a line
 * per working LIMIT order with a cancel button, and an arrow per recent
 * fill (the latest page) on its candle. One "Orders" toggle shows or hides
 * both, remembered on this device. Without the pair's id (FEQ-01) every
 * pair is read and narrowed by symbol.
 */
export function useChartOrders(
  pair: MarketPair,
  pairId: string | null,
): {
  lines: readonly ChartPriceLine[];
  markers: readonly ChartMarker[];
  toggle: ChartExtraItem;
} {
  const copy = useCopy();
  const p = copy.paper;
  const toast = useToast();
  const [shown, setShown] = useState(read);
  const open = useOpenOrders(pairId);
  const fills = useFillHistory({ pairId }, 1, shown);
  const { cancel } = usePaperActions();

  const flip = useCallback(() => {
    setShown((was) => {
      try {
        window.localStorage.setItem(STORAGE_KEY, String(!was));
      } catch {
        // Not remembered; the chart still switches.
      }
      return !was;
    });
  }, []);

  const lines = shown
    ? orderLines(
        open.data ?? [],
        pair,
        (order, remaining) =>
          formatCopy(p.chartOrderTitle, {
            side: order.side === 'BUY' ? p.sideBUY : p.sideSELL,
            quantity: remaining,
          }),
        (order) => ({
          label: formatCopy(p.cancelOrderLabel, {
            id: order.orderId.slice(-8),
          }),
          disabled: cancel.pending,
          onSelect: () =>
            void cancel.run(order.orderId).then((result) => {
              if (result.status === 'error')
                toast.show({
                  tone: 'error',
                  message: paperErrorText(copy, result.error),
                });
            }),
        }),
      )
    : [];
  const markers = shown
    ? fillMarkers(fills.data?.items ?? [], pair.symbol)
    : [];

  return {
    lines,
    markers,
    toggle: {
      id: 'orders',
      label: p.chartOrders,
      pressed: shown,
      onToggle: flip,
    },
  };
}
