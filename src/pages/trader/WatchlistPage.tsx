import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Star } from 'lucide-react';
import { EmptyState, ErrorState } from '../../components/feedback/States';
import { Button } from '../../components/ui/Button';
import { buttonClassName } from '../../components/ui/button-styles';
import { Skeleton } from '../../components/ui/Skeleton';
import { useCopy } from '../../hooks/use-copy';
import { usePlanTier } from '../../hooks/use-entitlement';
import { useToast } from '../../hooks/use-toast';
import { formatCopy } from '../../i18n/copy';
import { errorText, messageText } from '../../i18n/messages';
import {
  AlertDialog,
  type AlertDialogTarget,
} from '../../features/alerts/components/AlertDialog';
import { useMarketPairs } from '../../features/market/hooks/use-market-data';
import { useMarketTickers } from '../../features/market/hooks/use-market-tickers';
import { AddPairDialog } from '../../features/watchlist/components/AddPairDialog';
import { addablePairs } from '../../features/watchlist/components/addable-pairs';
import {
  WatchlistEditDialog,
  WatchlistRemoveDialog,
} from '../../features/watchlist/components/WatchlistDialogs';
import {
  WatchlistGroups,
  type WatchlistPrices,
} from '../../features/watchlist/components/WatchlistGroups';
import {
  confirmationCount,
  useAddToWatchlist,
  useWatchlist,
  useWatchlistActions,
  useWatchlistScores,
} from '../../features/watchlist/hooks/use-watchlist';
import type { WatchlistItem, WatchlistItemUpdate } from '../../types/domain';
import { pairLabel } from '../../utils/pair-label';

/**
 * SCR-12 Watchlist (SRS 3.4.1, UC-12): the Trader's pairs grouped by label
 * with live price, 24h change, setup score and active alerts; edit, reorder,
 * remove (MSG26, D-76), create an alert (SCR-14), and add a pair from both
 * market lists by its id (FEQ-01); creating an alert adds its pair (BR-16).
 */
export function WatchlistPage() {
  const copy = useCopy();
  const w = copy.watchlist;
  const { show } = useToast();
  const list = useWatchlist();
  const items = useMemo(() => list.data?.items ?? [], [list.data]);
  const { edit, reorder, removal } = useWatchlistActions();

  const spotSymbols = useMemo(
    () => items.filter((i) => i.spotListed).map((i) => i.symbol),
    [items],
  );
  const futuresSymbols = useMemo(
    () =>
      items
        .filter((i) => !i.spotListed && i.futuresListed)
        .map((i) => i.symbol),
    [items],
  );
  const spot = useMarketTickers('spot', spotSymbols);
  const futures = useMarketTickers('futures', futuresSymbols);
  const spotPairs = useMarketPairs('spot');
  const futuresPairs = useMarketPairs('futures');
  const scores = useWatchlistScores(spotSymbols);
  const prices: WatchlistPrices = useMemo(() => {
    const ticks = new Map<string, string | null>();
    for (const pair of [
      ...(spotPairs.data ?? []),
      ...(futuresPairs.data ?? []),
    ])
      ticks.set(pair.market + ':' + pair.symbol, pair.tickSize);
    return {
      spot: spot.tickers,
      futures: futures.tickers,
      tick: (market, symbol) => ticks.get(market + ':' + symbol) ?? null,
    };
  }, [spot.tickers, futures.tickers, spotPairs.data, futuresPairs.data]);

  const [alertTarget, setAlertTarget] = useState<AlertDialogTarget | null>(
    null,
  );
  const [editing, setEditing] = useState<WatchlistItem | null>(null);
  const [removing, setRemoving] = useState<{
    item: WatchlistItem;
    count: number;
  } | null>(null);

  const remove = useCallback(
    async (item: WatchlistItem, confirmed?: number) => {
      const result = await removal.run(item.id, confirmed);
      if (result.status === 'success') {
        setRemoving(null);
        show({
          tone: 'success',
          message: formatCopy(w.removed, { pair: pairLabel(item.symbol) }),
        });
        return;
      }
      if (result.status !== 'error') return;
      const count = confirmationCount(result.error);
      if (count !== null) {
        // The server's count of every alert of the row; ask (again).
        setRemoving({ item, count });
        return;
      }
      setRemoving(null);
      show({ tone: 'error', message: errorText(copy, result.error) });
    },
    [removal, show, copy, w.removed],
  );

  const save = useCallback(
    async (update: WatchlistItemUpdate) => {
      if (!editing) return null;
      const result = await edit.run(editing.id, update);
      if (result.status === 'success') {
        setEditing(null);
        show({ tone: 'success', message: messageText(copy, 'MSG14') });
        return null;
      }
      return result.status === 'error' ? result.error : null;
    },
    [edit, editing, show, copy],
  );

  const onReorder = useCallback(
    async (ordered: string[]) => {
      const result = await reorder.run(items, ordered);
      if (result.status === 'error')
        show({ tone: 'error', message: w.reorderFailed });
    },
    [reorder, items, show, w.reorderFailed],
  );

  const limit = list.data?.limit;
  const tier = usePlanTier();
  const busy = reorder.pending || removal.pending;

  const add = useAddToWatchlist();
  const [addOpen, setAddOpen] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addNotice, setAddNotice] = useState<string | null>(null);
  const addable = useMemo(
    () =>
      spotPairs.data && futuresPairs.data
        ? addablePairs(spotPairs.data, futuresPairs.data)
        : undefined,
    [spotPairs.data, futuresPairs.data],
  );
  const watchedIds = useMemo(
    () => new Set(items.map((item) => item.pairId)),
    [items],
  );
  const full = limit !== null && limit !== undefined && items.length >= limit;
  const pairsError = spotPairs.error ?? futuresPairs.error;
  const addPair = useCallback(
    async (pairId: string) => {
      setAddingId(pairId);
      setAddNotice(null);
      const result = await add.run(pairId);
      setAddingId(null);
      if (result.status === 'success')
        show({
          tone: 'success',
          message: formatCopy(w.addedToast, {
            pair: pairLabel(result.data.symbol),
          }),
        });
      else if (result.status === 'error')
        setAddNotice(errorText(copy, result.error));
    },
    [add, show, copy, w.addedToast],
  );

  const body = list.isPending ? (
    <div className="grid gap-3">
      {[0, 1, 2].map((n) => (
        <Skeleton key={n} className="h-16 w-full" />
      ))}
    </div>
  ) : list.isError ? (
    <ErrorState
      message={errorText(copy, list.error)}
      onRetry={() => void list.refetch()}
    />
  ) : items.length === 0 ? (
    <EmptyState
      icon={Star}
      title={w.empty}
      description={w.emptyHint}
      action={
        <Link
          to="/markets"
          className={buttonClassName('secondary', 'md', 'no-underline')}
        >
          {w.browseMarkets}
        </Link>
      }
    />
  ) : (
    <WatchlistGroups
      items={items}
      prices={prices}
      scores={scores.data}
      scoresLoading={scores.isPending && spotSymbols.length > 0}
      disabled={busy}
      onCreateAlert={(item) =>
        setAlertTarget({ mode: 'create', pairs: items, pairId: item.pairId })
      }
      onEdit={setEditing}
      onRemove={(item) => void remove(item)}
      onReorder={(ordered) => void onReorder(ordered)}
    />
  );

  return (
    <div className="mx-auto w-full max-w-5xl">
      <header className="mb-6 flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h1 className="text-lg font-semibold text-fg">{w.title}</h1>
          <p className="mt-0.5 text-xs text-muted-dim">{w.subtitle}</p>
        </div>
        {list.data && (
          <span className="font-mono text-xs text-muted" aria-live="polite">
            {limit === null || limit === undefined
              ? formatCopy(w.countUnlimited, { count: items.length })
              : formatCopy(w.count, { count: items.length, limit })}
          </span>
        )}
        <Button
          disabled={!list.data}
          onClick={() => {
            setAddNotice(null);
            setAddOpen(true);
          }}
        >
          <Plus size={14} aria-hidden="true" />
          {w.addPair}
        </Button>
      </header>
      {body}
      <AddPairDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        pairs={addable}
        loadError={pairsError ? errorText(copy, pairsError) : null}
        onRetry={() => {
          void spotPairs.refetch();
          void futuresPairs.refetch();
        }}
        watched={watchedIds}
        full={full}
        addingId={addingId}
        notice={
          addNotice ??
          (full && limit != null
            ? messageText(copy, 'MSG27', [], {
                max: limit,
                items: w.limitItems,
                plan: tier ?? '',
              })
            : null)
        }
        onAdd={(pairId) => void addPair(pairId)}
      />
      <AlertDialog target={alertTarget} onClose={() => setAlertTarget(null)} />
      <WatchlistEditDialog
        item={editing}
        onClose={() => setEditing(null)}
        onSave={save}
      />
      <WatchlistRemoveDialog
        pending={removing}
        busy={removal.pending}
        onCancel={() => setRemoving(null)}
        onConfirm={() => removing && void remove(removing.item, removing.count)}
      />
    </div>
  );
}
