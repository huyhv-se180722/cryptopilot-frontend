import { useState } from 'react';
import { ErrorState } from '../../../components/feedback/States';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { Skeleton } from '../../../components/ui/Skeleton';
import { useCopy } from '../../../hooks/use-copy';
import { formatCopy } from '../../../i18n/copy';
import { errorText } from '../../../i18n/messages';
import { PlanTable } from '../../trading-plan/components/PlanTable';
import { usePlanList } from '../../trading-plan/hooks/use-plans';
import { DashboardCard } from './DashboardCard';

type Shown = 'ACTIVE' | 'EXECUTED';
const ROWS = 5;

/**
 * Active plans and open positions (SCR-08): the first five of the ACTIVE
 * or the EXECUTED tab of SCR-16, a row opening SCR-18. Position status and
 * P/L wait for simulated execution (M-10), as on SCR-16.
 */
export function PlanSnapshot() {
  const copy = useCopy();
  const d = copy.dashboard;
  const p = copy.plan;
  const [tab, setTab] = useState<Shown>('ACTIVE');
  const list = usePlanList({ tab, page: 1 });
  const rows = list.data?.items.slice(0, ROWS) ?? [];
  const total = list.data?.total ?? 0;
  return (
    <DashboardCard
      title={d.plansTitle}
      link={{ to: `/plans?tab=${tab}`, label: d.manage }}
      actions={
        <SegmentedControl
          label={d.plansView}
          value={tab}
          onChange={setTab}
          options={[
            { value: 'ACTIVE', label: p.tabACTIVE },
            { value: 'EXECUTED', label: p.tabEXECUTED },
          ]}
        />
      }
    >
      {list.isPending ? (
        <Skeleton className="m-4 h-40" />
      ) : list.isError ? (
        <div className="p-4">
          <ErrorState
            message={errorText(copy, list.error)}
            onRetry={() => void list.refetch()}
          />
        </div>
      ) : (
        <>
          <PlanTable tab={tab} rows={rows} emptyMessage={p.empty} />
          {total > ROWS && (
            <p className="border-t border-line px-4 py-2 text-[11px] text-muted-dim">
              {formatCopy(d.plansMore, { shown: ROWS, total })}
            </p>
          )}
        </>
      )}
    </DashboardCard>
  );
}
