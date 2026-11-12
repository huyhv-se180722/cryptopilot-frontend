// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PaymentHistoryPage } from '../../pages/trader/PaymentHistoryPage';
import { PaymentResultPage } from '../../pages/trader/PaymentResultPage';
import { SubscriptionPage } from '../../pages/trader/SubscriptionPage';
import { SubscriptionSummary } from '../profile/components/SubscriptionSummary';
import type { SubscriptionService } from '../../services/api/contracts';
import { ServiceError } from '../../services/api/errors';
import { createPendingSubscriptionService } from '../../services/api/subscription';
import type {
  CurrentSubscription,
  SubscriptionOrder,
  SubscriptionPackage,
} from '../../types/domain';
import { fakeAuth, page, renderRoutes, testTrader } from '../../test/render';

const trader = () => fakeAuth({ restoreSession: async () => testTrader });

function pkg(
  code: string,
  tier: SubscriptionPackage['tier'],
  price: string,
  durationDays: number | null,
): SubscriptionPackage {
  return {
    code,
    name: code,
    tier,
    price,
    currency: 'VND',
    durationDays,
    purchasable: tier !== 'FREE',
    futuresAnalysis: true,
    scoreComponents: tier !== 'FREE',
    activePlanMax: tier === 'FREE' ? 3 : null,
    watchlistMax: 5,
    activeAlertMax: 3,
    indicatorAlert: tier !== 'FREE',
    externalAlertChannels: false,
    advancedPerformance: false,
    newsAiInsight: false,
    aiDailyQuota: 0,
    aiPerformanceContext: false,
    videoPost: false,
  };
}
const PACKAGES = [
  pkg('FREE', 'FREE', '0', null),
  pkg('PRO_MONTHLY', 'PRO', '99000', 30),
  pkg('PRO_YEARLY', 'PRO', '990000', 365),
  pkg('PREMIUM_MONTHLY', 'PREMIUM', '199000', 30),
];
const FREE: CurrentSubscription = {
  tier: 'FREE',
  packageCode: null,
  packageName: null,
  startAt: null,
  endAt: null,
  carriedValueVnd: null,
  bonusDays: null,
};
const PREMIUM: CurrentSubscription = {
  tier: 'PREMIUM',
  packageCode: 'PREMIUM_MONTHLY',
  packageName: 'Premium Monthly',
  startAt: '2026-11-08T00:00:00Z',
  endAt: '2026-12-08T00:00:00Z',
  carriedValueVnd: '0',
  bonusDays: 4,
};
const ORDER: SubscriptionOrder = {
  orderCode: 'CP1',
  packageCode: 'PRO_MONTHLY',
  packageName: 'Pro Monthly',
  orderType: 'NEW',
  amount: '99000',
  currency: 'VND',
  gateway: 'SEPAY',
  status: 'PENDING',
  createdAt: '2026-11-08T07:57:02Z',
  expiresAt: '2026-11-08T08:12:02Z',
  paidAt: null,
};

function billing(overrides: Partial<SubscriptionService>): SubscriptionService {
  return {
    ...createPendingSubscriptionService(),
    packages: async () => PACKAGES,
    gateways: async () => [
      { code: 'MOMO', enabled: false },
      { code: 'SEPAY', enabled: true },
    ],
    current: async () => FREE,
    ...overrides,
  };
}

beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
});

afterEach(() => vi.restoreAllMocks());

describe('Subscription screens', () => {
  it('quotes a package, then posts the signed form to the gateway', async () => {
    const user = userEvent.setup();
    const submit = vi
      .spyOn(HTMLFormElement.prototype, 'submit')
      .mockImplementation(() => undefined);
    const createOrder = vi.fn<SubscriptionService['createOrder']>(async () => ({
      order: ORDER,
      checkout: {
        method: 'POST',
        url: 'https://pay-sandbox.sepay.vn/v1/checkout/init',
        fields: { merchant: 'SP-TEST', signature: 'c2ln' },
      },
    }));
    await renderRoutes(
      [page('/subscription', <SubscriptionPage />)],
      '/subscription',
      trader(),
      {
        subscription: billing({
          quote: async () => ({
            packageCode: 'PRO_MONTHLY',
            orderType: 'NEW',
            amount: '99000',
            currency: 'VND',
            carriedValueVnd: '0',
            bonusDays: 0,
            startAt: '2026-11-08T00:00:00Z',
            endAt: '2026-12-08T00:00:00Z',
          }),
          createOrder,
        }),
      },
    );
    expect(await screen.findByText('You are on the Free plan.')).toBeTruthy();
    expect(screen.queryByLabelText('PRO_YEARLY')).toBeNull();
    const pro = screen.getByLabelText('PRO_MONTHLY');
    await user.click(within(pro).getByRole('button', { name: 'Choose' }));

    const dialog = await screen.findByRole('dialog');
    // A new order needs no type badge, and one gateway needs no choice.
    expect(within(dialog).queryByText('New subscription')).toBeNull();
    expect(within(dialog).queryByRole('radio')).toBeNull();
    expect(within(dialog).queryByText(/SePay/)).toBeNull();
    expect(within(dialog).getByText('(30 days)')).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: /^Pay / }));

    expect(createOrder).toHaveBeenCalledWith('PRO_MONTHLY', 'SEPAY');
    expect(submit).toHaveBeenCalledOnce();
    const form = document.querySelector('form[action]') as HTMLFormElement;
    expect(form.action).toBe('https://pay-sandbox.sepay.vn/v1/checkout/init');
    expect(form.method).toBe('post');
    expect(
      (form.elements.namedItem('signature') as HTMLInputElement).value,
    ).toBe('c2ln');
  });

  it('lets the trader pick a payment method only when two are on', async () => {
    const user = userEvent.setup();
    const createOrder = vi.fn<SubscriptionService['createOrder']>(async () => {
      throw new Error('stop here');
    });
    await renderRoutes(
      [page('/subscription', <SubscriptionPage />)],
      '/subscription',
      trader(),
      {
        subscription: billing({
          gateways: async () => [
            { code: 'MOMO', enabled: true },
            { code: 'SEPAY', enabled: true },
          ],
          quote: async () => ({
            packageCode: 'PRO_MONTHLY',
            orderType: 'NEW',
            amount: '99000',
            currency: 'VND',
            carriedValueVnd: '0',
            bonusDays: 0,
            startAt: '2026-11-08T00:00:00Z',
            endAt: '2026-12-08T00:00:00Z',
          }),
          createOrder,
        }),
      },
    );
    const pro = await screen.findByLabelText('PRO_MONTHLY');
    await user.click(within(pro).getByRole('button', { name: 'Choose' }));
    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByRole('radio', { name: 'MoMo e-wallet' }),
    ).toHaveProperty('checked', true);
    await user.click(
      within(dialog).getByRole('radio', { name: 'Bank transfer / QR' }),
    );
    await user.click(within(dialog).getByRole('button', { name: /^Pay / }));
    expect(createOrder).toHaveBeenCalledWith('PRO_MONTHLY', 'SEPAY');
  });

  it('offers a Premium holder no lower tier and shows the yearly packages', async () => {
    const user = userEvent.setup();
    await renderRoutes(
      [page('/subscription', <SubscriptionPage />)],
      '/subscription',
      trader(),
      { subscription: billing({ current: async () => PREMIUM }) },
    );
    const pro = await screen.findByLabelText('PRO_MONTHLY');
    expect(within(pro).getByText('Lower than your plan')).toBeTruthy();
    expect(
      within(screen.getByLabelText('PREMIUM_MONTHLY')).getByRole('button', {
        name: 'Renew',
      }),
    ).toBeTruthy();
    await user.click(screen.getByRole('radio', { name: 'Yearly' }));
    expect(screen.getByLabelText('PRO_YEARLY')).toBeTruthy();
    expect(screen.queryByLabelText('PRO_MONTHLY')).toBeNull();
  });

  it('names the refusal of a package no longer on sale', async () => {
    const user = userEvent.setup();
    await renderRoutes(
      [page('/subscription', <SubscriptionPage />)],
      '/subscription',
      trader(),
      {
        subscription: billing({
          quote: async () => {
            throw new ServiceError('refused', 'HTTP_ERROR', 409, {
              status: 409,
              code: 'PACKAGE_NOT_ON_SALE',
              messageCode: 'MSG43',
              messageArgs: [],
              fieldErrors: {},
            });
          },
        }),
      },
    );
    const pro = await screen.findByLabelText('PRO_MONTHLY');
    await user.click(within(pro).getByRole('button', { name: 'Choose' }));
    expect(
      await screen.findByText('This package is not on sale any more.'),
    ).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows the carried value and bonus days on an upgrade only', async () => {
    const user = userEvent.setup();
    const quote: SubscriptionService['quote'] = async (code) => ({
      packageCode: code,
      orderType: code === 'PRO_MONTHLY' ? 'RENEW' : 'UPGRADE',
      amount: code === 'PRO_MONTHLY' ? '99000' : '199000',
      currency: 'VND',
      carriedValueVnd: '50000',
      bonusDays: code === 'PRO_MONTHLY' ? 0 : 7,
      startAt: '2026-11-08T00:00:00Z',
      endAt: '2026-12-15T00:00:00Z',
    });
    await renderRoutes(
      [page('/subscription', <SubscriptionPage />)],
      '/subscription',
      trader(),
      {
        subscription: billing({
          current: async () => ({
            ...PREMIUM,
            tier: 'PRO',
            packageName: 'Pro Monthly',
          }),
          quote,
        }),
      },
    );
    const pro = await screen.findByLabelText('PRO_MONTHLY');
    await user.click(within(pro).getByRole('button', { name: 'Renew' }));
    let dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Renewal')).toBeTruthy();
    expect(
      within(dialog).queryByText('Value carried from your current plan'),
    ).toBeNull();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    const premium = screen.getByLabelText('PREMIUM_MONTHLY');
    await user.click(within(premium).getByRole('button', { name: 'Upgrade' }));
    dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByText('Value carried from your current plan'),
    ).toBeTruthy();
    expect(within(dialog).getByText('+7 days')).toBeTruthy();
  });

  it('shows the result the backend reports, not the redirect', async () => {
    await renderRoutes(
      [page('/subscription/payment-result', <PaymentResultPage />)],
      '/subscription/payment-result?orderCode=CP1',
      trader(),
      {
        subscription: billing({
          order: async () => ({
            ...ORDER,
            status: 'PAID',
            paidAt: ORDER.createdAt,
          }),
          current: async () => PREMIUM,
        }),
      },
    );
    expect(await screen.findByText('Payment confirmed')).toBeTruthy();
    expect(
      await screen.findByText(/^Pro Monthly is active until /),
    ).toBeTruthy();
  });

  it('keeps waiting on a pending order and needs an order code', async () => {
    const { unmount } = await renderRoutes(
      [page('/subscription/payment-result', <PaymentResultPage />)],
      '/subscription/payment-result?orderCode=CP1',
      trader(),
      { subscription: billing({ order: async () => ORDER }) },
    );
    expect(
      await screen.findByText('Waiting for the payment confirmation'),
    ).toBeTruthy();
    unmount();
    await renderRoutes(
      [page('/subscription/payment-result', <PaymentResultPage />)],
      '/subscription/payment-result',
      trader(),
      { subscription: billing({}) },
    );
    expect(
      await screen.findByText('This page needs an order code.'),
    ).toBeTruthy();
  });

  it('lists the orders and opens the result of a pending one', async () => {
    const user = userEvent.setup();
    await renderRoutes(
      [
        page('/subscription/payments', <PaymentHistoryPage />),
        page('/subscription/payment-result', <PaymentResultPage />),
      ],
      '/subscription/payments',
      trader(),
      {
        subscription: billing({
          orders: async () => ({
            items: [ORDER],
            page: 1,
            pageSize: 20,
            total: 1,
          }),
          order: async () => ORDER,
        }),
      },
    );
    expect(await screen.findByText('Pending')).toBeTruthy();
    await user.click(screen.getByText('CP1'));
    expect(
      await screen.findByText('Waiting for the payment confirmation'),
    ).toBeTruthy();
  });

  it('shows the plan held on the profile tab', async () => {
    await renderRoutes([page('/', <SubscriptionSummary />)], '/', trader(), {
      subscription: billing({ current: async () => PREMIUM }),
    });
    expect(await screen.findByText('Premium Monthly plan')).toBeTruthy();
    expect(screen.getByText(/^Active until /)).toBeTruthy();
    expect(
      screen.getByText(
        'Includes 4 bonus days carried from your previous plan.',
      ),
    ).toBeTruthy();
  });
});
