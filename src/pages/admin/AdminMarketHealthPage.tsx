import { ErrorState } from '../../components/feedback/States';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card } from '../../components/ui/Card';
import { Skeleton } from '../../components/ui/Skeleton';
import { Table } from '../../components/ui/Table';
import { MarketHealthCard } from '../../features/market-status/components/MarketHealthCard';
import {
  useMarketIncidents,
  type HealthMarket,
  type MarketIncident,
} from '../../features/market-status/hooks/use-market-health-admin';
import { useMarketStatus } from '../../features/market-status/hooks/use-market-status';
import { useCopy } from '../../hooks/use-copy';
import { errorText } from '../../i18n/messages';
import { formatInstantLocal } from '../../utils/instant-format';

/**
 * The markets' data health on the administration console (D-159, no SRS
 * screen): each market's state with its maintenance switch and reopening
 * by hand, and the incidents of each, newest first.
 */
export function AdminMarketHealthPage() {
  const t = useCopy().marketHealthAdmin;
  const status = useMarketStatus();
  return (
    <div className="flex w-full flex-col gap-4">
      <PageHeader size="sm" title={t.title} description={t.subtitle} />
      <div className="grid gap-4 lg:grid-cols-2">
        {status.markets.map((health) => (
          <MarketHealthCard key={health.market} health={health} />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Incidents market="SPOT" />
        <Incidents market="FUTURES" />
      </div>
    </div>
  );
}

function Incidents({ market }: { market: HealthMarket }) {
  const copy = useCopy();
  const t = copy.marketHealthAdmin;
  const c = copy.marketStatus;
  const incidents = useMarketIncidents(market);
  const title = t.incidents + ' · ' + (market === 'SPOT' ? c.spot : c.futures);
  return (
    <Card padding="none" className="overflow-hidden">
      <h2 className="px-4 pt-3 text-sm font-semibold text-fg">{title}</h2>
      {incidents.isPending ? (
        <Skeleton className="m-4 h-32" />
      ) : incidents.isError ? (
        <ErrorState
          message={errorText(copy, incidents.error)}
          onRetry={() => void incidents.refetch()}
        />
      ) : (
        <Table<MarketIncident>
          caption={title}
          rows={incidents.data}
          rowKey={(row) => row.id}
          emptyMessage={t.none}
          columns={[
            {
              id: 'kind',
              header: t.kind,
              render: (row) =>
                row.kind === 'MAINTENANCE'
                  ? t.states.MAINTENANCE
                  : c.reasons[row.reason],
            },
            {
              id: 'paused',
              header: t.pausedAt,
              render: (row) => formatInstantLocal(row.pausedAt),
            },
            {
              id: 'resumed',
              header: t.resumedAt,
              render: (row) =>
                row.resumedAt ? formatInstantLocal(row.resumedAt) : t.open,
            },
          ]}
        />
      )}
    </Card>
  );
}
