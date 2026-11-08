import type { SubscriptionService } from './contracts';
import { integrationPending } from './errors';
import type { HttpClient } from './http-client';
import {
  decodeCreatedOrder,
  decodeCurrentSubscription,
  decodeGateways,
  decodeOrder,
  decodeOrderPage,
  decodePackages,
  decodeQuote,
} from './subscription-dto';

/** Used while no API base URL is configured. */
export function createPendingSubscriptionService(): SubscriptionService {
  return {
    packages: async () => integrationPending(),
    gateways: async () => integrationPending(),
    quote: async () => integrationPending(),
    createOrder: async () => integrationPending(),
    orders: async () => integrationPending(),
    order: async () => integrationPending(),
    current: async () => integrationPending(),
  };
}

const withSignal = (signal?: AbortSignal) => (signal ? { signal } : {});

/**
 * `/billing/**` (T-066..T-069), checked against backend
 * `feature/T-066-billing-orders` @ 1502e14a: `PackageResponse`,
 * `GatewayResponse`, `QuoteResponse`, `CreateOrderResponse`,
 * `OrderResponse` pages and `SubscriptionResponse`. All need a session.
 */
export function createHttpSubscriptionService(
  http: HttpClient,
): SubscriptionService {
  return {
    packages: (signal) =>
      http.request({
        path: 'billing/packages',
        decode: decodePackages,
        ...withSignal(signal),
      }),
    gateways: (signal) =>
      http.request({
        path: 'billing/gateways',
        decode: decodeGateways,
        ...withSignal(signal),
      }),
    quote: (packageCode) =>
      http.request({
        path: 'billing/orders/quote',
        method: 'POST',
        body: { packageCode },
        decode: decodeQuote,
      }),
    createOrder: (packageCode, gateway) =>
      http.request({
        path: 'billing/orders',
        method: 'POST',
        body: { packageCode, gateway },
        decode: decodeCreatedOrder,
      }),
    orders: ({ page, pageSize }, signal) =>
      http.request({
        path: `billing/orders?page=${page}&pageSize=${pageSize}`,
        decode: decodeOrderPage,
        ...withSignal(signal),
      }),
    order: (orderCode, signal) =>
      http.request({
        path: 'billing/orders/' + encodeURIComponent(orderCode),
        decode: decodeOrder,
        ...withSignal(signal),
      }),
    current: (signal) =>
      http.request({
        path: 'billing/subscription',
        decode: decodeCurrentSubscription,
        ...withSignal(signal),
      }),
  };
}
