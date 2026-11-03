import { useMemo, useState } from 'react';
import { ErrorState } from '../../../components/feedback/States';
import { Skeleton } from '../../../components/ui/Skeleton';
import { useCopy } from '../../../hooks/use-copy';
import { errorText } from '../../../i18n/messages';
import { useMarketPairs } from '../../market/hooks/use-market-data';
import {
  useFuturesAccount,
  useFuturesPositions,
  useFuturesPush,
} from '../hooks/use-futures';
import { FuturesBottomPanel } from './FuturesBottomPanel';

/** The height of a tab's box on the orders page, px. */
const PANEL_HEIGHT = 480;

/**
 * The Futures side of the demo orders page (TR-07 for Futures): the same
 * panel as under the Futures chart, positions, open orders (with edit and
 * cancel), the order, trade, balance change and position histories, for
 * the pair chosen here. Every Trader has it, whatever the plan.
 */
export function FuturesOrdersView() {
  const copy = useCopy();
  const p = copy.paper;
  const pairs = useMarketPairs('futures');
  const [symbol, setSymbol] = useState('');
  useFuturesPush();
  const account = useFuturesAccount();
  const positions = useFuturesPositions(null);
  const ticks = useMemo(
    () =>
      new Map(
        (pairs.data ?? []).map((each) => [each.symbol, each.tickSize] as const),
      ),
    [pairs.data],
  );

  if (pairs.isPending) return <Skeleton className="h-[520px] w-full" />;
  if (pairs.isError)
    return (
      <ErrorState
        message={errorText(copy, pairs.error)}
        onRetry={() => void pairs.refetch()}
      />
    );
  // A pair with a position comes first, so the histories open on it.
  const held = positions.data?.[0]?.symbol;
  const pair =
    pairs.data.find((each) => each.symbol === symbol) ??
    pairs.data.find((each) => each.symbol === held) ??
    pairs.data[0];
  if (!pair) return <p className="text-sm text-muted">{copy.futures.noRows}</p>;
  return (
    <div className="flex flex-col gap-2">
      <label className="flex items-center gap-2 text-xs text-muted">
        {p.filterPair}
        <select
          value={pair.symbol}
          onChange={(event) => setSymbol(event.target.value)}
          className="h-8 rounded-lg border border-line bg-raised px-2 text-xs text-fg"
        >
          {pairs.data.map((each) => (
            <option key={each.symbol} value={each.symbol}>
              {each.symbol}
            </option>
          ))}
        </select>
      </label>
      <FuturesBottomPanel
        key={pair.symbol}
        pair={pair}
        positions={positions.data}
        ticks={ticks}
        account={account.data}
        height={PANEL_HEIGHT}
      />
    </div>
  );
}
