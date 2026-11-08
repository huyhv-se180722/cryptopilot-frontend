import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ErrorState } from '../../components/feedback/States';
import { PageHeader } from '../../components/layout/PageHeader';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { Pagination } from '../../components/ui/Pagination';
import { Skeleton } from '../../components/ui/Skeleton';
import { Table, type Column } from '../../components/ui/Table';
import {
  statusTone,
  vnd,
} from '../../features/subscription/components/billing-format';
import { useOrders } from '../../features/subscription/hooks/use-billing';
import { useCopy } from '../../hooks/use-copy';
import { errorText } from '../../i18n/messages';
import type { SubscriptionOrder } from '../../types/domain';
import { formatInstantLocal } from '../../utils/instant-format';

const PAGE_SIZE = 20;

/**
 * SCR-32 Payment history (UC-39): the Trader's orders, newest first. A
 * pending order opens its result page (SCR-31), which keeps asking for it.
 */
export function PaymentHistoryPage() {
  const copy = useCopy();
  const b = copy.billing;
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const orders = useOrders(page, PAGE_SIZE);

  const columns: readonly Column<SubscriptionOrder>[] = [
    {
      id: 'code',
      header: b.colCode,
      render: (o) => <span className="font-mono">{o.orderCode}</span>,
    },
    { id: 'package', header: b.colPackage, render: (o) => o.packageName },
    { id: 'type', header: b.colType, render: (o) => b[`type${o.orderType}`] },
    {
      id: 'amount',
      header: b.colAmount,
      numeric: true,
      render: (o) => vnd(o.amount),
    },
    { id: 'gateway', header: b.colGateway, render: (o) => o.gateway },
    {
      id: 'status',
      header: b.colStatus,
      render: (o) => (
        <Badge tone={statusTone[o.status]}>{b[`status${o.status}`]}</Badge>
      ),
    },
    {
      id: 'created',
      header: b.colCreated,
      render: (o) => formatInstantLocal(o.createdAt),
    },
    {
      id: 'paid',
      header: b.colPaid,
      render: (o) => (o.paidAt ? formatInstantLocal(o.paidAt) : '—'),
    },
  ];

  const body = orders.isPending ? (
    <Skeleton className="h-64 w-full" />
  ) : orders.isError ? (
    <ErrorState
      message={errorText(copy, orders.error)}
      onRetry={() => void orders.refetch()}
    />
  ) : (
    <>
      <Table
        caption={b.historyCaption}
        columns={columns}
        rows={orders.data.items}
        rowKey={(o) => o.orderCode}
        emptyMessage={b.historyEmpty}
        onRowClick={(o) =>
          o.status === 'PENDING' &&
          navigate(
            '/subscription/payment-result?orderCode=' +
              encodeURIComponent(o.orderCode),
          )
        }
      />
      {orders.data.total > PAGE_SIZE && (
        <div className="mt-4 flex justify-center">
          <Pagination
            page={page}
            total={orders.data.total}
            pageSize={PAGE_SIZE}
            onChange={setPage}
          />
        </div>
      )}
    </>
  );

  return (
    <div className="mx-auto w-full max-w-5xl">
      <PageHeader title={b.historyTitle} description={b.historySubtitle} />
      <Card padding="none" className="p-3">
        {body}
      </Card>
    </div>
  );
}
