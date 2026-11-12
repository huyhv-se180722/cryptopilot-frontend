import { describe, expect, it, vi } from 'vitest';
import { createHttpClient } from './http-client';
import { createHttpSubscriptionService } from './subscription';
import {
  decodeCreatedOrder,
  decodeCurrentSubscription,
  decodePackages,
} from './subscription-dto';

/** Shapes of the backend branch feature/T-066-billing-orders @ 1502e14a. */
const PRO = {
  code: 'PRO_MONTHLY',
  name: 'Pro Monthly',
  tier: 'PRO',
  price: '99000',
  currency: 'VND',
  durationDays: 30,
  purchasable: true,
  futuresAnalysis: true,
  scoreComponents: true,
  activePlanMax: null,
  watchlistMax: 50,
  activeAlertMax: 20,
  indicatorAlert: true,
  externalAlertChannels: true,
  advancedPerformance: true,
  newsAiInsight: true,
  aiDailyQuota: 30,
  aiPerformanceContext: false,
  videoPost: true,
};
const ORDER = {
  orderCode: 'CP261108075702XL4O',
  packageCode: 'PRO_MONTHLY',
  packageName: 'Pro Monthly',
  orderType: 'NEW',
  amount: '99000',
  currency: 'VND',
  gateway: 'SEPAY',
  status: 'PENDING',
  createdAt: '2026-11-08T07:57:02.172697Z',
  expiresAt: '2026-11-08T08:12:02.149983Z',
  paidAt: null,
};
const CHECKOUT = {
  method: 'POST',
  url: 'https://pay-sandbox.sepay.vn/v1/checkout/init',
  fields: { merchant: 'SP-TEST', order_amount: '99000', signature: 'c2ln' },
};

function setup(reply: unknown) {
  const calls: { url: URL; init: RequestInit | undefined }[] = [];
  const http = createHttpClient({
    baseUrl: 'https://api.example.test/api/v1',
    fetcher: vi.fn<typeof fetch>(async (input, init) => {
      calls.push({ url: new URL(String(input)), init });
      return new Response(JSON.stringify(reply), { status: 200 });
    }),
    session: { accessToken: () => null, refresh: async () => 'ended' },
  });
  return { billing: createHttpSubscriptionService(http), calls };
}

describe('Subscription adapter', () => {
  it('decodes a package with an unlimited limit', () => {
    const [pkg] = decodePackages([PRO]);
    expect(pkg?.activePlanMax).toBeNull();
    expect(pkg?.price).toBe('99000');
    expect(() => decodePackages([{ ...PRO, tier: 'GOLD' }])).toThrow();
  });

  it('decodes the FREE plan with no package or dates', () => {
    const free = decodeCurrentSubscription({
      tier: 'FREE',
      packageCode: null,
      packageName: null,
      startAt: null,
      endAt: null,
      carriedValueVnd: null,
      bonusDays: null,
    });
    expect(free).toMatchObject({ tier: 'FREE', endAt: null, bonusDays: null });
  });

  it('keeps the signed checkout fields as sent and refuses a plain-http gateway', () => {
    const created = decodeCreatedOrder({ order: ORDER, checkout: CHECKOUT });
    expect(created.checkout.fields).toEqual(CHECKOUT.fields);
    expect(created.order.paidAt).toBeNull();
    expect(() =>
      decodeCreatedOrder({
        order: ORDER,
        checkout: { ...CHECKOUT, url: 'http://pay.example.test' },
      }),
    ).toThrow();
  });

  it('posts the package and gateway when creating an order', async () => {
    const { billing, calls } = setup({ order: ORDER, checkout: CHECKOUT });
    await billing.createOrder('PRO_MONTHLY', 'SEPAY');
    expect(calls[0]?.url.pathname).toBe('/api/v1/billing/orders');
    expect(calls[0]?.init?.method).toBe('POST');
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({
      packageCode: 'PRO_MONTHLY',
      gateway: 'SEPAY',
    });
  });

  it('asks for one order by its code and for a page of orders', async () => {
    const one = setup(ORDER);
    await one.billing.order('CP261108075702XL4O');
    expect(one.calls[0]?.url.pathname).toBe(
      '/api/v1/billing/orders/CP261108075702XL4O',
    );
    const page = setup({ items: [ORDER], page: 2, pageSize: 20, total: 21 });
    const result = await page.billing.orders({ page: 2, pageSize: 20 });
    expect(page.calls[0]?.url.search).toBe('?page=2&pageSize=20');
    expect(result.items[0]?.status).toBe('PENDING');
  });
});
