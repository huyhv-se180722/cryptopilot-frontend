import type {
  OrderStatus,
  OrderType,
  PaymentGatewayCode,
  PlanTier,
} from '../../types/domain';
import {
  decimal,
  flag,
  instant,
  integer,
  list,
  nullableInstant,
  nullableText,
  oneOf,
  record,
  text,
} from './decode';
import { integrationPending } from './errors';
import type { HttpClient } from './http-client';

export const ORDER_STATUSES: readonly OrderStatus[] = [
  'PENDING',
  'PAID',
  'FAILED',
  'EXPIRED',
];
export const ORDER_TYPES: readonly OrderType[] = ['NEW', 'RENEW', 'UPGRADE'];
export const ORDER_GATEWAYS: readonly PaymentGatewayCode[] = [
  'SEPAY',
  'MOMO',
  'VNPAY',
];
const TIERS: readonly PlanTier[] = ['FREE', 'PRO', 'PREMIUM'];

export type SubscriptionState = 'ACTIVE' | 'EXPIRED' | 'CANCELLED' | 'REPLACED';
const SUBSCRIPTION_STATES: readonly SubscriptionState[] = [
  'ACTIVE',
  'EXPIRED',
  'CANCELLED',
  'REPLACED',
];

/** One subscription order in the administrator's payment list (SCR-40, UC-48). */
export interface AdminOrder {
  orderCode: string;
  userId: string;
  packageCode: string;
  packageName: string;
  tier: PlanTier;
  orderType: OrderType;
  amount: string;
  currency: string;
  gateway: PaymentGatewayCode;
  status: OrderStatus;
  createdAt: string;
  expiresAt: string;
  paidAt: string | null;
  /** Paid but changed no subscription: waits for an administrator. */
  manualHandling: boolean;
  handledAt: string | null;
}

export interface AdminOrderSubscription {
  status: SubscriptionState;
  startAt: string;
  endAt: string;
  carriedValueVnd: string;
  bonusDays: number;
}

/** One order with what its gateway answered and what it activated. */
export interface AdminOrderDetail {
  order: AdminOrder;
  gatewayTransactionNo: string | null;
  gatewayResponseCode: string | null;
  /** The gateway's last message as JSON text. */
  gatewayPayload: string | null;
  ipnReceivedAt: string | null;
  handledBy: string | null;
  handlingNote: string | null;
  subscription: AdminOrderSubscription | null;
}

export interface AdminOrderPage {
  items: readonly AdminOrder[];
  page: number;
  pageSize: number;
  total: number;
}

export interface AdminOrderQuery {
  page: number;
  status?: OrderStatus;
  orderType?: OrderType;
  gateway?: PaymentGatewayCode;
  /** First and last day of creation, `YYYY-MM-DD` (Asia/Ho_Chi_Minh). */
  from?: string;
  to?: string;
  /** Only the orders waiting for, or handled by, an administrator. */
  manual?: boolean;
  /** The order code or its beginning. */
  orderCode?: string;
}

/** SCR-40 (UC-48): the subscription orders, Admin only. */
export interface AdminOrderService {
  list(query: AdminOrderQuery, signal?: AbortSignal): Promise<AdminOrderPage>;
  detail(orderCode: string, signal?: AbortSignal): Promise<AdminOrderDetail>;
  /** Asks the gateway about the order now (audited). */
  reconcile(orderCode: string): Promise<AdminOrderDetail>;
  /** Records how a flagged order was handled (audited). */
  markHandled(orderCode: string, note: string): Promise<AdminOrderDetail>;
}

export const ORDERS_PAGE_SIZE = 20;
export const HANDLING_NOTE_MAX = 1000;

/**
 * Decoders for `/admin/orders/**`, checked against backend develop
 * @ c1803226: `AdminOrderResponse`, `AdminOrderDetailResponse` in
 * `PageResponse` (one-based pages).
 */
export function decodeAdminOrder(body: unknown): AdminOrder {
  const v = record(body, 'order');
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
    expiresAt: instant(v.expiresAt, 'expiresAt'),
    paidAt: nullableInstant(v.paidAt, 'paidAt'),
    manualHandling: flag(v.manualHandling, 'manualHandling'),
    handledAt: nullableInstant(v.handledAt, 'handledAt'),
  };
}

export function decodeAdminOrderPage(body: unknown): AdminOrderPage {
  const v = record(body);
  return {
    items: list(v.items, 'items').map(decodeAdminOrder),
    page: integer(v.page, 'page'),
    pageSize: integer(v.pageSize, 'pageSize'),
    total: integer(v.total, 'total'),
  };
}

function decodeSubscription(body: unknown): AdminOrderSubscription | null {
  if (body === null || body === undefined) return null;
  const v = record(body, 'subscription');
  return {
    status: oneOf(SUBSCRIPTION_STATES, v.status, 'subscription.status'),
    startAt: instant(v.startAt, 'subscription.startAt'),
    endAt: instant(v.endAt, 'subscription.endAt'),
    carriedValueVnd: decimal(v.carriedValueVnd, 'subscription.carriedValueVnd'),
    bonusDays: integer(v.bonusDays, 'subscription.bonusDays'),
  };
}

export function decodeAdminOrderDetail(body: unknown): AdminOrderDetail {
  const v = record(body);
  return {
    order: decodeAdminOrder(v.order),
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
    subscription: decodeSubscription(v.subscription),
  };
}

/** The query string of a list request; empty filters are left out. */
export function adminOrderParams(query: AdminOrderQuery): URLSearchParams {
  const params = new URLSearchParams({
    page: String(query.page),
    pageSize: String(ORDERS_PAGE_SIZE),
  });
  if (query.status) params.set('status', query.status);
  if (query.orderType) params.set('orderType', query.orderType);
  if (query.gateway) params.set('gateway', query.gateway);
  if (query.from) params.set('from', query.from);
  if (query.to) params.set('to', query.to);
  if (query.manual) params.set('manual', 'true');
  if (query.orderCode) params.set('orderCode', query.orderCode);
  return params;
}

/** Used while no API base URL is configured. */
export function createPendingAdminOrderService(): AdminOrderService {
  return {
    list: async () => integrationPending(),
    detail: async () => integrationPending(),
    reconcile: async () => integrationPending(),
    markHandled: async () => integrationPending(),
  };
}

/** `/admin/orders/**` (UC-48), Admin only. */
export function createHttpAdminOrderService(
  http: HttpClient,
): AdminOrderService {
  const path = (orderCode: string) =>
    'admin/orders/' + encodeURIComponent(orderCode);
  return {
    list: (query, signal) =>
      http.request({
        path: 'admin/orders?' + adminOrderParams(query).toString(),
        decode: decodeAdminOrderPage,
        ...(signal ? { signal } : {}),
      }),
    detail: (orderCode, signal) =>
      http.request({
        path: path(orderCode),
        decode: decodeAdminOrderDetail,
        ...(signal ? { signal } : {}),
      }),
    reconcile: (orderCode) =>
      http.request({
        path: path(orderCode) + '/reconcile',
        method: 'POST',
        decode: decodeAdminOrderDetail,
      }),
    markHandled: (orderCode, note) =>
      http.request({
        path: path(orderCode) + '/handled',
        method: 'POST',
        body: { note },
        decode: decodeAdminOrderDetail,
      }),
  };
}
