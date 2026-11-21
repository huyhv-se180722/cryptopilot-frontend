import { describe, expect, it, vi } from 'vitest';
import {
  createHttpAdminOrderService,
  decodeAdminOrderDetail,
  decodeAdminOrderPage,
} from './admin-orders';
import type { HttpClient } from './http-client';

export const ORDER = {
  orderCode: 'CP2611210001',
  userId: '01a18806-f703-7786-8f90-8c7c34ce23e8',
  packageCode: 'PRO_30',
  packageName: 'Pro 30 days',
  tier: 'PRO',
  orderType: 'UPGRADE',
  amount: '199000',
  currency: 'VND',
  gateway: 'SEPAY',
  status: 'PAID',
  createdAt: '2026-11-21T01:00:00Z',
  expiresAt: '2026-11-21T01:15:00Z',
  paidAt: '2026-11-21T01:03:00Z',
  manualHandling: true,
  handledAt: null,
};

export const DETAIL = {
  order: ORDER,
  gatewayTransactionNo: 'FT2611210001',
  gatewayResponseCode: '00',
  gatewayPayload: '{"transferAmount":199000,"content":"CP2611210001"}',
  ipnReceivedAt: '2026-11-21T01:03:05Z',
  handledBy: null,
  handlingNote: null,
  subscription: null,
};

function client(answer: unknown) {
  const request = vi.fn(
    async ({ decode }: { decode: (body: unknown) => unknown }) =>
      decode(answer),
  );
  return { http: { request } as unknown as HttpClient, request };
}

describe('SCR-40 admin orders (T-087)', () => {
  it('reads a page and a detail, amounts as strings', () => {
    const page = decodeAdminOrderPage({
      items: [ORDER],
      page: 1,
      pageSize: 20,
      total: 1,
    });
    expect(page.items[0]).toMatchObject({
      amount: '199000',
      gateway: 'SEPAY',
      manualHandling: true,
    });
    const detail = decodeAdminOrderDetail({
      ...DETAIL,
      subscription: {
        status: 'ACTIVE',
        startAt: '2026-11-21T01:03:00Z',
        endAt: '2026-12-21T01:03:00Z',
        carriedValueVnd: '45000',
        bonusDays: 0,
      },
    });
    expect(detail.subscription?.status).toBe('ACTIVE');
    expect(detail.gatewayResponseCode).toBe('00');
  });

  it('refuses a gateway or status it does not know', () => {
    expect(() =>
      decodeAdminOrderPage({
        items: [{ ...ORDER, gateway: 'PAYPAL' }],
        page: 1,
        pageSize: 20,
        total: 1,
      }),
    ).toThrow(/gateway/);
    expect(() =>
      decodeAdminOrderDetail({ ...DETAIL, order: { ...ORDER, status: 'X' } }),
    ).toThrow(/status/);
  });

  it('sends the filters, the reconcile and the handling note', async () => {
    const { http, request } = client({
      items: [],
      page: 2,
      pageSize: 20,
      total: 0,
    });
    const service = createHttpAdminOrderService(http);
    await service.list({
      page: 2,
      status: 'PENDING',
      orderType: 'NEW',
      gateway: 'MOMO',
      from: '2026-11-01',
      to: '2026-11-21',
      manual: true,
      orderCode: 'CP26',
    });
    expect(request.mock.calls[0]?.[0]).toMatchObject({
      path: 'admin/orders?page=2&pageSize=20&status=PENDING&orderType=NEW&gateway=MOMO&from=2026-11-01&to=2026-11-21&manual=true&orderCode=CP26',
    });
    const { http: h2, request: r2 } = client(DETAIL);
    const s2 = createHttpAdminOrderService(h2);
    await s2.reconcile('CP 1');
    await s2.markHandled('CP2611210001', 'Refunded.');
    expect(r2.mock.calls.map(([call]) => call)).toMatchObject([
      { path: 'admin/orders/CP%201/reconcile', method: 'POST' },
      {
        path: 'admin/orders/CP2611210001/handled',
        method: 'POST',
        body: { note: 'Refunded.' },
      },
    ]);
  });
});
