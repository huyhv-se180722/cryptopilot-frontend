import { useDeferredValue, useState } from 'react';
import { Plus } from 'lucide-react';
import { ErrorState } from '../../components/feedback/States';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { Skeleton } from '../../components/ui/Skeleton';
import { PairEditDialog } from '../../features/admin/components/PairEditDialog';
import { PairTable } from '../../features/admin/components/PairTable';
import { RegisterPairDialog } from '../../features/admin/components/RegisterPairDialog';
import { useAdminPairs } from '../../features/admin/hooks/use-admin-pairs';
import { useCopy } from '../../hooks/use-copy';
import { errorText } from '../../i18n/messages';
import type { AdminPair, PairStatus } from '../../types/domain';

type Filter = PairStatus | 'ALL';

/**
 * SCR-37 Manage Pairs (SRS 3.11.6, UC-45): the pairs searched by symbol
 * and filtered by status, each market's switch beside the exchange's
 * status, Edit for a pair's settings and Add pair from the exchange's
 * symbols. Layout from the Figma admin coins table; data from the API.
 */
export function AdminPairsPage() {
  const copy = useCopy();
  const t = copy.adminPairs;
  const [typed, setTyped] = useState('');
  const q = useDeferredValue(typed.trim().toUpperCase());
  const [filter, setFilter] = useState<Filter>('ALL');
  const [editing, setEditing] = useState<AdminPair | null>(null);
  const [adding, setAdding] = useState(false);
  const pairs = useAdminPairs(q, filter === 'ALL' ? null : filter);

  return (
    <div className="w-full">
      <PageHeader
        size="sm"
        title={t.title}
        description={t.subtitle}
        actions={
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus size={14} aria-hidden="true" />
            {t.addPair}
          </Button>
        }
      />
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <div className="w-full max-w-xs">
          <Input
            label={t.searchLabel}
            placeholder={t.searchPlaceholder}
            autoComplete="off"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
          />
        </div>
        <SegmentedControl<Filter>
          label={t.statusFilter}
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'ALL', label: t.all },
            { value: 'ACTIVE', label: t.statusACTIVE },
            { value: 'INACTIVE', label: t.statusINACTIVE },
          ]}
        />
      </div>
      {pairs.isPending ? (
        <div className="grid gap-2">
          {[0, 1, 2, 3].map((k) => (
            <Skeleton key={k} className="h-11 w-full" />
          ))}
        </div>
      ) : pairs.isError ? (
        <ErrorState
          message={errorText(copy, pairs.error)}
          onRetry={() => void pairs.refetch()}
        />
      ) : (
        <PairTable pairs={pairs.data} onEdit={setEditing} />
      )}
      <PairEditDialog pair={editing} onClose={() => setEditing(null)} />
      <RegisterPairDialog open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}
