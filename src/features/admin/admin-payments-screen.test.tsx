// @vitest-environment jsdom
import { beforeAll, describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminPaymentsPage } from '../../pages/admin/AdminPaymentsPage';
import type {
  AdminOrder,
  AdminOrderDetail,
  AdminOrderQuery,
  AdminOrderService,
} from '../../services/api/admin-orders';
import type { Session } from '../../types/domain';
import { fakeAuth, page, renderRoutes } from '../../test/render';

beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
});

const admin: Session = {
  user: {
    id: 'dev-admin',
    email: 'admin@dev.local',
    displayName: 'Dev Admin',
    role: 'Admin',
    status: 'active',
  },
  entitlements: 'unknown',
};
const signedIn = fakeAuth({ restoreSession: async () => admin });

const order = (n: number, patch: Partial<AdminOrder> = {}): AdminOrder => ({
  orderCode: 'CP' + String(n).padStart(6, '0'),
  userId: '0199a0f0-0000-7000-8000-000000000001',
  packageCode: 'PRO_MONTHLY',
  packageName: 'Pro monthly',
  tier: 'PRO',
  orderType: 'NEW',
  amount: '99000',
  currency: 'VND',
  gateway: 'SEPAY',
  status: 'PAID',
  createdAt: '2026-11-10T03:00:00Z',
  expiresAt: '2026-11-10T03:15:00Z',
  paidAt: '2026-11-10T03:05:00Z',
  manualHandling: false,
  handledAt: null,
  ...patch,
});

/** In-memory `/admin/orders/**`: 25 orders, CP000001 pending, CP000002 flagged. */
function fakeOrders() {
  const orders = Array.from({ length: 25 }, (_, i) => order(i + 1));
  orders[0] = order(1, { status: 'PENDING', paidAt: null });
  orders[1] = order(2, { manualHandling: true, gateway: 'MOMO' });
  const notes = new Map<string, string>();
  const calls: AdminOrderQuery[] = [];
  const detail = (code: string): AdminOrderDetail => {
    const o = orders.find((x) => x.orderCode === code);
    if (!o) throw new Error('not found');
    return {
      order: o,
      gatewayTransactionNo: o.paidAt ? 'TX-' + code : null,
      gatewayResponseCode: o.paidAt ? '00' : null,
      gatewayPayload: o.paidAt ? '{"resultCode":0}' : null,
      ipnReceivedAt: o.paidAt,
      handledBy: o.handledAt ? 'dev-admin' : null,
      handlingNote: notes.get(code) ?? null,
      subscription:
        o.status === 'PAID' && !o.manualHandling
          ? {
              status: 'ACTIVE',
              startAt: '2026-11-10T03:05:00Z',
              endAt: '2026-12-10T03:05:00Z',
              carriedValueVnd: '0',
              bonusDays: 0,
            }
          : null,
    };
  };
  const service: AdminOrderService = {
    list: async (query) => {
      calls.push(query);
      const hit = orders.filter(
        (o) =>
          (!query.status || o.status === query.status) &&
          (!query.gateway || o.gateway === query.gateway) &&
          (!query.manual || o.manualHandling) &&
          (!query.orderCode || o.orderCode.startsWith(query.orderCode)),
      );
      return {
        items: hit.slice((query.page - 1) * 20, query.page * 20),
        page: query.page,
        pageSize: 20,
        total: hit.length,
      };
    },
    detail: async (code) => detail(code),
    reconcile: async (code) => {
      const i = orders.findIndex((o) => o.orderCode === code);
      orders[i] = {
        ...orders[i]!,
        status: 'PAID',
        paidAt: '2026-11-10T03:06:00Z',
      };
      return detail(code);
    },
    markHandled: async (code, note) => {
      const i = orders.findIndex((o) => o.orderCode === code);
      orders[i] = { ...orders[i]!, handledAt: '2026-11-11T01:00:00Z' };
      notes.set(code, note);
      return detail(code);
    },
  };
  return { service, calls };
}

const open = (adminOrders: AdminOrderService) =>
  renderRoutes(
    [page('/admin/payments', <AdminPaymentsPage />)],
    '/admin/payments',
    signedIn,
    { adminOrders },
  );

const rows = () =>
  within(screen.getByRole('table')).getAllByRole('row').slice(1);

const dialog = (code: string) =>
  within(screen.getByRole('dialog', { name: 'Order ' + code }));

describe('SCR-40 payments (UC-48)', () => {
  it('lists 20 orders a page with the total and pages on', async () => {
    await open(fakeOrders().service);
    expect(await screen.findByText('25 orders')).toBeTruthy();
    expect(rows()).toHaveLength(20);
    expect(screen.getByText('Page 1 of 2')).toBeTruthy();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('Page 2 of 2')).toBeTruthy();
    expect(rows()).toHaveLength(5);
  });

  it('filters on the server, back on the first page, and clears', async () => {
    const { service, calls } = fakeOrders();
    await open(service);
    const user = userEvent.setup();
    await screen.findByText('25 orders');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByText('Page 2 of 2');
    await user.click(screen.getByLabelText('Only flagged orders'));
    expect(await screen.findByText('1 order')).toBeTruthy();
    expect(calls.at(-1)).toMatchObject({ page: 1, manual: true });
    expect(within(rows()[0]!).getByText('Needs handling')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(await screen.findByText('25 orders')).toBeTruthy();
    await user.type(screen.getByLabelText('Order code'), 'CP9');
    expect(
      await screen.findByText('No order matches these filters.'),
    ).toBeTruthy();
  });

  it('does not send a reversed day range', async () => {
    const { service, calls } = fakeOrders();
    await open(service);
    const user = userEvent.setup();
    await screen.findByText('25 orders');
    await user.type(screen.getByLabelText('Created from'), '2026-11-10');
    await user.type(screen.getByLabelText('Created to'), '2026-11-01');
    expect(
      await screen.findByText('The first day is after the last day.'),
    ).toBeTruthy();
    const last = calls.at(-1)!;
    expect(last.from).toBeUndefined();
    expect(last.to).toBeUndefined();
  });

  it('opens an order with its gateway answer and subscription', async () => {
    await open(fakeOrders().service);
    const user = userEvent.setup();
    await screen.findByText('25 orders');
    await user.click(screen.getByText('CP000003'));
    const d = dialog('CP000003');
    expect(await d.findByText('TX-CP000003')).toBeTruthy();
    expect(d.getByText(/"resultCode": 0/)).toBeTruthy();
    expect(d.getByText('Active')).toBeTruthy();
    expect(d.queryByRole('button', { name: 'Ask the gateway now' })).toBe(null);
  });

  it('asks the gateway again about a pending order', async () => {
    await open(fakeOrders().service);
    const user = userEvent.setup();
    await screen.findByText('25 orders');
    await user.click(screen.getByText('CP000001'));
    const d = dialog('CP000001');
    expect(
      await d.findByText('The gateway has not answered yet.'),
    ).toBeTruthy();
    await user.click(d.getByRole('button', { name: 'Ask the gateway now' }));
    expect(await d.findByText('TX-CP000001')).toBeTruthy();
    expect(d.queryByRole('button', { name: 'Ask the gateway now' })).toBe(null);
  });

  it('records how a flagged order was handled, with a required note', async () => {
    await open(fakeOrders().service);
    const user = userEvent.setup();
    await screen.findByText('25 orders');
    await user.click(screen.getByText('CP000002'));
    const d = dialog('CP000002');
    await user.click(await d.findByRole('button', { name: 'Mark as handled' }));
    expect(d.getByText('Write how the order was handled.')).toBeTruthy();
    await user.type(
      d.getByLabelText('How it was handled'),
      'Refunded 99,000 VND by bank transfer',
    );
    await user.click(d.getByRole('button', { name: 'Mark as handled' }));
    expect(
      await d.findByText('Refunded 99,000 VND by bank transfer'),
    ).toBeTruthy();
    expect(d.queryByRole('button', { name: 'Mark as handled' })).toBe(null);
  });
});
