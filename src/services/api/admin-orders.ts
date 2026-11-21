import type {
  AdminOrder,
  AdminOrderDetail,
  AdminOrderPage,
  AdminSubscriptionStatus,
  OrderStatus,
  OrderType,
  PaymentGatewayCode,
  PlanTier,
} from '../../types/domain';
import type { AdminOrderService } from './contracts';
import {
  decimal,
  flag,
  instant,
  integer,
  list,
  nullableDecimal,
  nullableInstant,
  nullableText,
  oneOf,
  record,
  text,
} from './decode';
import { integrationPending } from './errors';
import type { HttpClient } from './http-client';

export const ADMIN_ORDER_PAGE_SIZE = 20;
export const ORDER_STATUSES: readonly OrderStatus[] = [
  'PENDING',
  'PAID',
  'FAILED',
  'EXPIRED',
];
export const ORDER_TYPES: readonly OrderType[] = ['NEW', 'RENEW', 'UPGRADE'];
export const ORDER_GATEWAYS: readonly PaymentGatewayCode[] = [
  'VNPAY',
  'MOMO',
  'SEPAY',
];
const TIERS: readonly PlanTier[] = ['FREE', 'PRO', 'PREMIUM'];
const SUBSCRIPTION_STATUSES: readonly AdminSubscriptionStatus[] = [
  'ACTIVE',
  'EXPIRED',
  'CANCELLED',
  'REPLACED',
];

function order(value: unknown, name = 'order'): AdminOrder {
  const v = record(value, name);
  return {
    orderCode: text(v.orderCode, 'orderCode'),
    userId: text(v.userId, 'userId'),
    packageCode: text(v.packageCode, 'packageCode'),
    packageName: text(v.packageName, 'packageName'),
    tier: oneOf(TIERS, v.tier, 'tier'),
    orderType: oneOf(ORDER_TYPES, v.orderType, 'orderType'),
    amount: decimal(v.amount, 'amount'),
    currency: text(v.currency, 'currency'),
    gateway: oneOf(ORDER_GATEWAYS, v.gateway, 'gateway'),
    status: oneOf(ORDER_STATUSES, v.status, 'status'),
    createdAt: instant(v.createdAt, 'createdAt'),
    expiresAt: nullableInstant(v.expiresAt, 'expiresAt'),
    paidAt: nullableInstant(v.paidAt, 'paidAt'),
    manualHandling: flag(v.manualHandling, 'manualHandling'),
    handledAt: nullableInstant(v.handledAt, 'handledAt'),
  };
}

/** `GET /admin/orders`: one page, newest first. */
export function decodeAdminOrderPage(body: unknown): AdminOrderPage {
  const v = record(body);
  return {
    items: list(v.items, 'items').map((item, i) =>
      order(item, 'items[' + i + ']'),
    ),
    page: integer(v.page, 'page'),
    pageSize: integer(v.pageSize, 'pageSize'),
    total: integer(v.total, 'total'),
  };
}

/** `GET /admin/orders/{code}` and the actions that answer with it. */
export function decodeAdminOrderDetail(body: unknown): AdminOrderDetail {
  const v = record(body);
  const sub =
    v.subscription === null || v.subscription === undefined
      ? null
      : record(v.subscription, 'subscription');
  return {
    order: order(v.order),
    gatewayTransactionNo: nullableText(
      v.gatewayTransactionNo,
      'gatewayTransactionNo',
    ),
    gatewayResponseCode: nullableText(
      v.gatewayResponseCode,
      'gatewayResponseCode',
    ),
    gatewayPayload: nullableText(v.gatewayPayload, 'gatewayPayload'),
    ipnReceivedAt: nullableInstant(v.ipnReceivedAt, 'ipnReceivedAt'),
    handledBy: nullableText(v.handledBy, 'handledBy'),
    handlingNote: nullableText(v.handlingNote, 'handlingNote'),
    subscription: sub && {
      status: oneOf(SUBSCRIPTION_STATUSES, sub.status, 'subscription.status'),
      startAt: instant(sub.startAt, 'subscription.startAt'),
      endAt: nullableInstant(sub.endAt, 'subscription.endAt'),
      carriedValueVnd: nullableDecimal(
        sub.carriedValueVnd,
        'subscription.carriedValueVnd',
      ),
      bonusDays: integer(sub.bonusDays, 'subscription.bonusDays'),
    },
  };
}

/** Used while no API base URL is configured. */
export function createPendingAdminOrderService(): AdminOrderService {
  const pending = async () => integrationPending();
  return {
    list: pending,
    get: pending,
    reconcile: pending,
    markHandled: pending,
  };
}

const withSignal = (signal?: AbortSignal) => (signal ? { signal } : {});

/** `/admin/orders/**` (SCR-40, Admin only; reconcile and handled audited). */
export function createHttpAdminOrderService(
  http: HttpClient,
): AdminOrderService {
  const one = (code: string) => 'admin/orders/' + encodeURIComponent(code);
  return {
    list: (query, signal) => {
      const params = new URLSearchParams({
        page: String(query.page),
        pageSize: String(ADMIN_ORDER_PAGE_SIZE),
      });
      if (query.status) params.set('status', query.status);
      if (query.orderType) params.set('orderType', query.orderType);
      if (query.gateway) params.set('gateway', query.gateway);
      if (query.from) params.set('from', query.from);
      if (query.to) params.set('to', query.to);
      if (query.manual) params.set('manual', 'true');
      if (query.orderCode) params.set('orderCode', query.orderCode);
      return http.request({
        path: 'admin/orders?' + params.toString(),
        decode: decodeAdminOrderPage,
        ...withSignal(signal),
      });
    },
    get: (code, signal) =>
      http.request({
        path: one(code),
        decode: decodeAdminOrderDetail,
        ...withSignal(signal),
      }),
    reconcile: (code) =>
      http.request({
        path: one(code) + '/reconcile',
        method: 'POST',
        decode: decodeAdminOrderDetail,
      }),
    markHandled: (code, note) =>
      http.request({
        path: one(code) + '/handled',
        method: 'POST',
        body: { note },
        decode: decodeAdminOrderDetail,
      }),
  };
}
