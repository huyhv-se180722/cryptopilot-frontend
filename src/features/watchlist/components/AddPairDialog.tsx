import { useState } from 'react';
import { Check, Plus, Search } from 'lucide-react';
import { ErrorState } from '../../../components/feedback/States';
import { FormNotice } from '../../../components/feedback/FormNotice';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Dialog } from '../../../components/ui/Dialog';
import { Skeleton } from '../../../components/ui/Skeleton';
import { useCopy } from '../../../hooks/use-copy';
import { formatCopy } from '../../../i18n/copy';
import { pairLabel } from '../../../utils/pair-label';
import { matchesPair, type AddablePair } from './addable-pairs';

/**
 * SCR-12 Add pair (UC-12; no Figma frame, after the exchange's add to
 * favorites): every pair of both market lists with a search by symbol or
 * coin, where it is listed, and Add, or Added for a watched pair. A refusal
 * (MSG45, MSG27, MSG41) shows in the dialog, which stays open; at the plan's
 * limit every Add is disabled.
 */
export function AddPairDialog({
  open,
  onOpenChange,
  pairs,
  loadError,
  onRetry,
  watched,
  full,
  addingId,
  notice,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** undefined while the market lists are read. */
  pairs: readonly AddablePair[] | undefined;
  /** Why the market lists could not be read, or null. */
  loadError: string | null;
  onRetry: () => void;
  /** Pair ids already on the watchlist. */
  watched: ReadonlySet<string>;
  /** The plan's limit is reached (MSG27 shown in `notice`). */
  full: boolean;
  /** The pair being added, or null. */
  addingId: string | null;
  /** The last refusal, or null. */
  notice: string | null;
  onAdd: (pairId: string) => void;
}) {
  const copy = useCopy();
  const w = copy.watchlist;
  const m = copy.market;
  const [query, setQuery] = useState('');
  const shown = (pairs ?? []).filter((pair) => matchesPair(pair, query));

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={w.addPairTitle}>
      <div className="flex flex-col gap-3">
        <label className="relative flex items-center">
          <span className="sr-only">{w.addPairSearch}</span>
          <Search
            size={13}
            aria-hidden="true"
            className="pointer-events-none absolute left-3 text-muted-dim"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={w.addPairSearch}
            className="h-9 w-full rounded-lg border border-line bg-surface pr-3 pl-8 text-xs text-fg placeholder:text-muted-dim focus:border-primary focus:outline-none pointer-coarse:h-11"
          />
        </label>
        {notice && <FormNotice tone="error">{notice}</FormNotice>}
        {loadError ? (
          <ErrorState message={loadError} onRetry={onRetry} />
        ) : !pairs ? (
          <div className="flex flex-col gap-2">
            {[0, 1, 2, 3].map((n) => (
              <Skeleton key={n} className="h-10 w-full" />
            ))}
          </div>
        ) : shown.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted">{w.addPairNone}</p>
        ) : (
          <ul
            aria-label={w.addPairList}
            className="-mx-1 flex max-h-90 flex-col overflow-y-auto"
          >
            {shown.map((pair) => {
              const label = pairLabel(pair.symbol);
              const isWatched = watched.has(pair.pairId);
              return (
                <li
                  key={pair.pairId}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg px-1 py-2 hover:bg-raised"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-fg">
                      {label}
                    </span>
                    {pair.baseAssetName && (
                      <span className="block truncate text-[11px] text-muted-dim">
                        {pair.baseAssetName}
                      </span>
                    )}
                  </span>
                  <span className="flex gap-1">
                    {pair.spot && <Badge>{m.spot}</Badge>}
                    {pair.futures && <Badge>{m.futures}</Badge>}
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={isWatched || full || addingId !== null}
                    aria-label={
                      isWatched
                        ? formatCopy(w.addedPair, { pair: label })
                        : formatCopy(w.addPairFor, { pair: label })
                    }
                    onClick={() => onAdd(pair.pairId)}
                  >
                    {isWatched ? (
                      <Check size={13} aria-hidden="true" />
                    ) : (
                      <Plus size={13} aria-hidden="true" />
                    )}
                    {isWatched ? w.added : w.add}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Dialog>
  );
}
