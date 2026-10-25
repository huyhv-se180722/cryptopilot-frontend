import { useSearchParams } from 'react-router-dom';
import { ErrorState } from '../../components/feedback/States';
import { PageHeader } from '../../components/layout/PageHeader';
import { Select } from '../../components/ui/Select';
import { Skeleton } from '../../components/ui/Skeleton';
import { BracketEditor } from '../../features/admin/components/BracketEditor';
import {
  useAdminPairs,
  usePairBrackets,
} from '../../features/admin/hooks/use-admin-pairs';
import { useCopy } from '../../hooks/use-copy';
import { errorText } from '../../i18n/messages';
import { pairLabel } from '../../utils/pair-label';

/**
 * SCR-38 Manage Leverage Brackets (SRS 3.11.6, UC-46): a pair the
 * exchange lists on Futures, chosen by `?pair=` (Pairs links each), and
 * its brackets as one editable table. No Figma frame: the layout follows
 * the admin tables of SCR-37.
 */
export function AdminBracketsPage() {
  const copy = useCopy();
  const b = copy.adminBrackets;
  const [params, setParams] = useSearchParams();
  const pairs = useAdminPairs('', null);
  const futures = (pairs.data ?? []).filter(
    (pair) => pair.futures.exchangeStatus !== null,
  );
  const wanted = params.get('pair')?.toUpperCase();
  const pair = futures.find((each) => each.symbol === wanted) ?? futures[0];
  const brackets = usePairBrackets(pair?.pairId ?? null);

  const body = pairs.isPending ? (
    <Skeleton className="h-48 w-full" />
  ) : pairs.isError ? (
    <ErrorState
      message={errorText(copy, pairs.error)}
      onRetry={() => void pairs.refetch()}
    />
  ) : !pair ? (
    <p role="status" className="text-sm text-muted">
      {b.noFutures}
    </p>
  ) : (
    <div className="grid gap-4">
      <div className="w-full max-w-xs">
        <Select
          label={b.pairField}
          value={pair.symbol}
          onChange={(event) =>
            setParams({ pair: event.target.value }, { replace: true })
          }
        >
          {futures.map((each) => (
            <option key={each.pairId} value={each.symbol}>
              {pairLabel(each.symbol)}
            </option>
          ))}
        </Select>
      </div>
      {brackets.isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : brackets.isError ? (
        <ErrorState
          message={errorText(copy, brackets.error)}
          onRetry={() => void brackets.refetch()}
        />
      ) : (
        <BracketEditor
          key={pair.pairId + brackets.dataUpdatedAt}
          pair={pair}
          saved={brackets.data}
        />
      )}
    </div>
  );

  return (
    <div className="w-full">
      <PageHeader size="sm" title={b.title} description={b.subtitle} />
      {body}
    </div>
  );
}
