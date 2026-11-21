// @vitest-environment jsdom
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminPaymentsPage } from '../../pages/admin/AdminPaymentsPage';
import type { AdminOrderService } from '../../services/api/contracts';
import { ServiceError } from '../../services/api/errors';
import type { AdminOrder, AdminOrderDetail } from '../../types/domain';
import { page, renderRoutes } from '../../test/render';

beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.open = false;
  };
});

const ORDER: AdminOrder = {
  orderCode: 'CP2611210001',
  userId: 'u-1',
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
const PENDING: AdminOrder = {
  ...ORDER,
  orderCode: 'CP2611210002',
  status: 'PENDING',
  paidAt: null,
  manualHandling: false,
};
const detail = (order: AdminOrder): AdminOrderDetail => ({
  order,
  gatewayTransactionNo: 'FT1',
  gatewayResponseCode: '00',
  gatewayPayload: '{"transferAmount":199000}',
  ipnReceivedAt: '2026-11-21T01:03:05Z',
  handledBy: null,
  handlingNote: null,
  subscription: null,
});

function service(): AdminOrderService {
  return {
    list: vi.fn(async (query) => ({
      items: [ORDER, PENDING],
      page: query.page,
      pageSize: 20,
      total: 2,
    })),
    get: vi.fn(async (code) =>
      detail(code === ORDER.orderCode ? ORDER : PENDING),
    ),
    reconcile: vi.fn(async () => detail({ ...PENDING, status: 'EXPIRED' })),
    markHandled: vi.fn(async (_code, note) => ({
      ...detail({ ...ORDER, handledAt: '2026-11-21T02:00:00Z' }),
      handlingNote: note,
    })),
  };
}

const open = (adminOrders = service()) =>
  renderRoutes(
    [page('/admin/payments', <AdminPaymentsPage />)],
    '/admin/payments',
    undefined,
    { adminOrders },
  ).then(() => adminOrders);

describe('SCR-40 payments (T-087)', () => {
  it('lists the orders with amount, gateway, status and the manual flag', async () => {
    await open();
    const table = await screen.findByRole('table', {
      name: 'Subscription orders',
    });
    const row = within(table)
      .getByRole('button', { name: 'Open order CP2611210001' })
      .closest('tr') as HTMLElement;
    expect(row.textContent).toContain('199,000 VND');
    expect(row.textContent).toContain('SEPAY');
    expect(row.textContent).toContain('Paid');
    expect(row.textContent).toContain('Awaiting handling');
  });

  it('filters on the server and starts again from the first page', async () => {
    const user = userEvent.setup();
    const orders = await open();
    await screen.findByRole('table', { name: 'Subscription orders' });
    await user.selectOptions(screen.getByLabelText('Status'), 'PENDING');
    await user.selectOptions(screen.getByLabelText('Gateway'), 'MOMO');
    await user.click(screen.getByLabelText('Manual handling only'));
    await waitFor(() =>
      expect(vi.mocked(orders.list).mock.calls.at(-1)?.[0]).toEqual({
        page: 1,
        status: 'PENDING',
        gateway: 'MOMO',
        manual: true,
      }),
    );
  });

  it('reconciles a pending order', async () => {
    const user = userEvent.setup();
    const orders = await open();
    await user.click(
      await screen.findByRole('button', { name: 'Open order CP2611210002' }),
    );
    await user.click(
      await screen.findByRole('button', { name: 'Reconcile', hidden: true }),
    );
    await waitFor(() =>
      expect(orders.reconcile).toHaveBeenCalledWith('CP2611210002'),
    );
    expect(
      await screen.findByText(
        'The gateway was asked; the order is up to date.',
      ),
    ).toBeTruthy();
  });

  it('records how a flagged order was handled, a note required', async () => {
    const user = userEvent.setup();
    const orders = await open();
    await user.click(
      await screen.findByRole('button', { name: 'Open order CP2611210001' }),
    );
    const button = await screen.findByRole('button', {
      name: 'Mark as handled',
      hidden: true,
    });
    expect(
      screen.getByText('"transferAmount": 199000', { exact: false }),
    ).toBeTruthy();
    await user.click(button);
    expect(
      screen.getByText('The handling note field is required.'),
    ).toBeTruthy();
    expect(orders.markHandled).not.toHaveBeenCalled();
    await user.type(
      screen.getByLabelText('Handling note'),
      'Refunded through the gateway.',
    );
    await user.click(button);
    await waitFor(() =>
      expect(orders.markHandled).toHaveBeenCalledWith(
        'CP2611210001',
        'Refunded through the gateway.',
      ),
    );
    expect(await screen.findByText('Saved successfully.')).toBeTruthy();
  });

  it('shows the gateway error when it cannot be asked', async () => {
    const user = userEvent.setup();
    const orders = service();
    vi.mocked(orders.reconcile).mockRejectedValue(
      new ServiceError('Unavailable', 'HTTP_ERROR', 503, {
        status: 503,
        code: 'PAYMENT_GATEWAY_UNAVAILABLE',
        messageCode: 'MSG43',
        messageArgs: ['ref-1'],
        fieldErrors: {},
      }),
    );
    await open(orders);
    await user.click(
      await screen.findByRole('button', { name: 'Open order CP2611210002' }),
    );
    await user.click(
      await screen.findByRole('button', { name: 'Reconcile', hidden: true }),
    );
    expect(
      (await screen.findByRole('alert', { hidden: true })).textContent,
    ).toContain('Something went wrong');
  });
});
