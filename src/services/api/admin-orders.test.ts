import { describe, expect, it } from 'vitest';
import {
  adminOrderParams,
  decodeAdminOrderDetail,
  decodeAdminOrderPage,
} from './admin-orders';

/** As backend develop @ c1803226 answers `GET /admin/orders/{code}`. */
const failed = {
  orderCode: 'CPX26102503',
  userId: '01a10ccb-1c00-7e83-a165-0b1059117d24',
  packageCode: 'PRO_MONTHLY',
  packageName: 'Pro Monthly',
  tier: 'PRO',
  orderType: 'NEW',
  amount: '99000',
  currency: 'VND',
  gateway: 'VNPAY',
  status: 'FAILED',
  createdAt: '2026-10-25T00:00:00Z',
  expiresAt: '2026-10-25T00:15:00Z',
  paidAt: null,
  manualHandling: false,
  handledAt: null,
};

describe('admin orders decoders', () => {
  it('reads a page of orders', () => {
    const page = decodeAdminOrderPage({
      items: [failed],
      page: 1,
      pageSize: 20,
      total: 16,
    });
    expect(page.total).toBe(16);
    expect(page.items[0]).toMatchObject({ status: 'FAILED', paidAt: null });
  });

  it('reads an order without a gateway message or subscription', () => {
    const detail = decodeAdminOrderDetail({
      order: failed,
      gatewayTransactionNo: null,
      gatewayResponseCode: '24',
      gatewayPayload: null,
      ipnReceivedAt: null,
      handledBy: null,
      handlingNote: null,
      subscription: null,
    });
    expect(detail.gatewayResponseCode).toBe('24');
    expect(detail.subscription).toBeNull();
  });

  it('reads the subscription an order opened', () => {
    const detail = decodeAdminOrderDetail({
      order: { ...failed, status: 'PAID', paidAt: '2026-10-25T00:05:00Z' },
      subscription: {
        status: 'ACTIVE',
        startAt: '2026-10-25T00:05:00Z',
        endAt: '2026-11-24T00:05:00Z',
        carriedValueVnd: '0',
        bonusDays: 0,
      },
    });
    expect(detail.subscription?.status).toBe('ACTIVE');
    expect(detail.gatewayPayload).toBeNull();
  });

  it('refuses an unknown status', () => {
    expect(() =>
      decodeAdminOrderPage({
        items: [{ ...failed, status: 'REFUNDED' }],
        page: 1,
        pageSize: 20,
        total: 1,
      }),
    ).toThrow();
  });

  it('sends only the filters that are set', () => {
    expect(adminOrderParams({ page: 2 }).toString()).toBe('page=2&pageSize=20');
    expect(
      adminOrderParams({
        page: 1,
        status: 'PAID',
        gateway: 'MOMO',
        from: '2026-11-01',
        to: '2026-11-10',
        manual: true,
        orderCode: 'CPX',
      }).toString(),
    ).toBe(
      'page=1&pageSize=20&status=PAID&gateway=MOMO&from=2026-11-01&to=2026-11-10&manual=true&orderCode=CPX',
    );
  });
});
