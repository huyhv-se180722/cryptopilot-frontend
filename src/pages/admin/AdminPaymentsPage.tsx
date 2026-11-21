import { useDeferredValue, useState } from 'react';
import { ErrorState } from '../../components/feedback/States';
import { PageHeader } from '../../components/layout/PageHeader';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Pagination } from '../../components/ui/Pagination';
import { Skeleton } from '../../components/ui/Skeleton';
import { Table, type Column } from '../../components/ui/Table';
import { OrderDetailDialog } from '../../features/admin/components/OrderDetailDialog';
import { OrderFilters } from '../../features/admin/components/OrderFilters';
import {
  NO_FILTER,
  filterCount,
  type OrderFilter,
} from '../../features/admin/components/order-format';
import {
  ORDERS_PAGE_SIZE,
  useAdminOrders,
  type AdminOrder,
  type AdminOrderQuery,
} from '../../features/admin/hooks/use-admin-orders';
import {
  statusTone,
  vnd,
} from '../../features/subscription/components/billing-format';
import { useCopy } from '../../hooks/use-copy';
import { formatCopy } from '../../i18n/copy';
import { errorText } from '../../i18n/messages';
import { formatInstantLocal } from '../../utils/instant-format';

/**
 * SCR-40 Payments (UC-48): every subscription order, newest first, 20 a
 * page from the server, searched by order code and narrowed by one Filters
 * panel (status, type, gateway, creation days, flagged orders). A row opens the order with its
 * gateway answer, where an Admin asks the gateway again or records how a
 * flagged order was handled; both are audited by the backend.
 */
export function AdminPaymentsPage() {
  const copy = useCopy();
  const t = copy.adminPayments;
  const b = copy.billing;
  const [typed, setTyped] = useState('');
  const code = useDeferredValue(typed.trim());
  const [filter, setFilter] = useState<OrderFilter>(NO_FILTER);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);
  const query: AdminOrderQuery = {
    page,
    ...(code ? { orderCode: code } : {}),
    ...(filter.status ? { status: filter.status } : {}),
    ...(filter.orderType ? { orderType: filter.orderType } : {}),
    ...(filter.gateway ? { gateway: filter.gateway } : {}),
    ...(filter.from ? { from: filter.from } : {}),
    ...(filter.to ? { to: filter.to } : {}),
    ...(filter.manual ? { manual: true } : {}),
  };
  const filtered = Boolean(code) || filterCount(filter) > 0;
  const orders = useAdminOrders(query);
  const total = orders.data?.total ?? 0;
  const pageSize = orders.data?.pageSize || ORDERS_PAGE_SIZE;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (orders.data && !orders.isPlaceholderData && page > pages) setPage(pages);

  const columns: readonly Column<AdminOrder>[] = [
    {
      id: 'code',
      header: b.colCode,
      render: (o) => <span className="font-mono">{o.orderCode}</span>,
    },
    { id: 'package', header: b.colPackage, render: (o) => o.packageName },
    { id: 'tier', header: t.colTier, render: (o) => o.tier },
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
      id: 'flag',
      header: t.colFlag,
      render: (o) =>
        !o.manualHandling ? (
          '—'
        ) : o.handledAt === null ? (
          <Badge tone="danger">{t.flagWaiting}</Badge>
        ) : (
          <Badge tone="neutral">{t.flagHandled}</Badge>
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

  return (
    <div className="w-full">
      <PageHeader
        size="sm"
        title={t.title}
        description={t.subtitle}
        {...(orders.data
          ? {
              actions: (
                <span className="text-xs text-muted-dim">
                  {total === 1 ? t.totalOne : formatCopy(t.total, { n: total })}
                </span>
              ),
            }
          : {})}
      />
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <div className="w-full sm:w-64">
          <Input
            label={t.searchLabel}
            placeholder={t.searchPlaceholder}
            autoComplete="off"
            type="search"
            value={typed}
            onChange={(event) => {
              setTyped(event.target.value);
              setPage(1);
            }}
          />
        </div>
        <OrderFilters
          value={filter}
          onChange={(next) => {
            // A new filter starts again from the first page.
            setFilter(next);
            setPage(1);
          }}
        />
      </div>
      <Card padding="none" className="p-3">
        {orders.isPending ? (
          <div className="grid gap-2">
            {[0, 1, 2, 3, 4].map((k) => (
              <Skeleton key={k} className="h-12 w-full" />
            ))}
          </div>
        ) : orders.isError ? (
          <ErrorState
            message={errorText(copy, orders.error)}
            onRetry={() => void orders.refetch()}
          />
        ) : (
          <>
            <Table
              caption={t.caption}
              columns={columns}
              rows={orders.data.items}
              rowKey={(o) => o.orderCode}
              emptyMessage={filtered ? t.emptyFiltered : t.empty}
              onRowClick={(o) => setOpen(o.orderCode)}
            />
            {pages > 1 && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-muted-dim">
                  {formatCopy(t.showing, {
                    from: (page - 1) * pageSize + 1,
                    to: Math.min(page * pageSize, total),
                    n: total,
                  })}
                </span>
                <Pagination
                  page={page}
                  total={total}
                  pageSize={pageSize}
                  onChange={setPage}
                  disabled={orders.isPlaceholderData}
                />
              </div>
            )}
          </>
        )}
      </Card>
      <OrderDetailDialog orderCode={open} onClose={() => setOpen(null)} />
    </div>
  );
}
