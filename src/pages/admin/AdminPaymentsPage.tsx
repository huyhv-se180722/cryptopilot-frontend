import { useDeferredValue, useMemo, useState } from 'react';
import { ErrorState } from '../../components/feedback/States';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Checkbox } from '../../components/ui/Checkbox';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Skeleton } from '../../components/ui/Skeleton';
import { Table, type Column } from '../../components/ui/Table';
import { OrderDetailDialog } from '../../features/admin/components/OrderDetailDialog';
import { OrderStatusBadge } from '../../features/admin/components/OrderStatusBadge';
import { useAdminOrders } from '../../features/admin/hooks/use-admin-orders';
import { useCopy } from '../../hooks/use-copy';
import { formatCopy } from '../../i18n/copy';
import { errorText } from '../../i18n/messages';
import type {
  AdminOrder,
  AdminOrderQuery,
  OrderStatus,
  OrderType,
  PaymentGatewayCode,
} from '../../types/domain';
import { groupThousands } from '../../utils/decimal-format';
import { formatInstantLocal } from '../../utils/instant-format';

const STATUSES: readonly OrderStatus[] = [
  'PENDING',
  'PAID',
  'FAILED',
  'EXPIRED',
];
const TYPES: readonly OrderType[] = ['NEW', 'RENEW', 'UPGRADE'];
const GATEWAYS: readonly PaymentGatewayCode[] = ['VNPAY', 'MOMO', 'SEPAY'];

/**
 * SCR-40 Payment Transactions (SRS 3.11.5): subscription orders, newest
 * first, filtered by status, order type, gateway, period of creation,
 * the manual-handling flag and the order code; an order opens its gateway
 * data, reconciliation and handling note. Design without Figma (layout of
 * the admin users table); needs designer review.
 */
export function AdminPaymentsPage() {
  const copy = useCopy();
  const t = copy.adminOrders;
  const [typed, setTyped] = useState('');
  const code = useDeferredValue(typed.trim());
  const [status, setStatus] = useState<OrderStatus | ''>('');
  const [orderType, setOrderType] = useState<OrderType | ''>('');
  const [gateway, setGateway] = useState<PaymentGatewayCode | ''>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [manual, setManual] = useState(false);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);
  const query: AdminOrderQuery = {
    page,
    ...(status ? { status } : {}),
    ...(orderType ? { orderType } : {}),
    ...(gateway ? { gateway } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    ...(manual ? { manual } : {}),
    ...(code ? { orderCode: code } : {}),
  };
  const filtered = Boolean(
    code || status || orderType || gateway || from || to || manual,
  );
  const orders = useAdminOrders(query);
  const total = orders.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / (orders.data?.pageSize || 20)));
  const filter =
    <T,>(set: (value: T) => void) =>
    (value: T) => {
      set(value);
      setPage(1);
    };

  const columns = useMemo<readonly Column<AdminOrder>[]>(
    () => [
      {
        id: 'code',
        header: t.columnCode,
        render: (order) => (
          <button
            type="button"
            onClick={() => setOpen(order.orderCode)}
            aria-label={formatCopy(t.openOrder, { code: order.orderCode })}
            className="font-mono text-xs font-semibold text-fg hover:text-primary"
          >
            {order.orderCode}
          </button>
        ),
      },
      {
        id: 'created',
        header: t.columnCreated,
        render: (order) => formatInstantLocal(order.createdAt),
      },
      {
        id: 'package',
        header: t.columnPackage,
        render: (order) => order.packageName,
      },
      {
        id: 'type',
        header: t.columnType,
        render: (order) => t[`type${order.orderType}`],
      },
      {
        id: 'amount',
        header: t.columnAmount,
        numeric: true,
        render: (order) => `${groupThousands(order.amount)} ${order.currency}`,
      },
      {
        id: 'gateway',
        header: t.columnGateway,
        render: (order) => order.gateway,
      },
      {
        id: 'status',
        header: t.columnStatus,
        render: (order) => (
          <span className="inline-flex flex-wrap items-center gap-1.5">
            <OrderStatusBadge status={order.status} />
            {order.manualHandling && (
              <span className="text-[11px] text-warning">
                {order.handledAt ? t.handled : t.awaitingHandling}
              </span>
            )}
          </span>
        ),
      },
    ],
    [t],
  );

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
                  {formatCopy(t.total, { n: total })}
                </span>
              ),
            }
          : {})}
      />
      <div className="mb-3 grid gap-3 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-end">
        <div className="lg:w-56">
          <Input
            label={t.searchLabel}
            placeholder={t.searchPlaceholder}
            autoComplete="off"
            type="search"
            value={typed}
            onChange={(event) => filter(setTyped)(event.target.value)}
          />
        </div>
        <div className="lg:w-36">
          <Select
            label={t.columnStatus}
            value={status}
            onChange={(event) =>
              filter(setStatus)(event.target.value as OrderStatus | '')
            }
          >
            <option value="">{t.any}</option>
            {STATUSES.map((value) => (
              <option key={value} value={value}>
                {t[`status${value}`]}
              </option>
            ))}
          </Select>
        </div>
        <div className="lg:w-36">
          <Select
            label={t.columnType}
            value={orderType}
            onChange={(event) =>
              filter(setOrderType)(event.target.value as OrderType | '')
            }
          >
            <option value="">{t.any}</option>
            {TYPES.map((value) => (
              <option key={value} value={value}>
                {t[`type${value}`]}
              </option>
            ))}
          </Select>
        </div>
        <div className="lg:w-36">
          <Select
            label={t.columnGateway}
            value={gateway}
            onChange={(event) =>
              filter(setGateway)(event.target.value as PaymentGatewayCode | '')
            }
          >
            <option value="">{t.any}</option>
            {GATEWAYS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
        </div>
        <div className="lg:w-40">
          <Input
            label={t.from}
            type="date"
            value={from}
            onChange={(event) => filter(setFrom)(event.target.value)}
          />
        </div>
        <div className="lg:w-40">
          <Input
            label={t.to}
            type="date"
            value={to}
            onChange={(event) => filter(setTo)(event.target.value)}
          />
        </div>
        <div className="flex items-center lg:h-11">
          <Checkbox
            label={t.manualOnly}
            checked={manual}
            onChange={(event) => filter(setManual)(event.target.checked)}
          />
        </div>
      </div>
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
            caption={t.tableCaption}
            columns={columns}
            rows={orders.data.items}
            rowKey={(order) => order.orderCode}
            onRowClick={(order) => setOpen(order.orderCode)}
            emptyMessage={filtered ? t.emptyFiltered : t.empty}
          />
          {pages > 1 && (
            <div className="mt-3 flex items-center justify-end gap-2 text-xs text-muted-dim">
              <span>{formatCopy(t.pageOf, { page, pages })}</span>
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                {t.previous}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= pages}
                onClick={() => setPage((p) => p + 1)}
              >
                {t.next}
              </Button>
            </div>
          )}
        </>
      )}
      {open && <OrderDetailDialog code={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
