import type { SubscriptionService } from '../services/api/contracts';
import { ServiceError } from '../services/api/errors';
import type {
  CurrentSubscription,
  PlanTier,
  SubscriptionOrder,
  SubscriptionPackage,
} from '../types/domain';

const DAY = 86_400_000;

function refuse(status: number, code: string, messageCode: string): never {
  throw new ServiceError('Development billing refusal.', 'HTTP_ERROR', status, {
    status,
    code,
    messageCode,
    messageArgs: [],
    fieldErrors: {},
  });
}

const limits = (tier: PlanTier) => ({
  futuresAnalysis: tier !== 'FREE',
  scoreComponents: tier !== 'FREE',
  activePlanMax: tier === 'FREE' ? 3 : tier === 'PRO' ? 20 : null,
  watchlistMax: tier === 'FREE' ? 10 : tier === 'PRO' ? 50 : null,
  activeAlertMax: tier === 'FREE' ? 5 : tier === 'PRO' ? 50 : null,
  indicatorAlert: tier !== 'FREE',
  externalAlertChannels: tier !== 'FREE',
  advancedPerformance: tier !== 'FREE',
  newsAiInsight: tier !== 'FREE',
  aiDailyQuota: tier === 'FREE' ? 5 : tier === 'PRO' ? 30 : 100,
  aiPerformanceContext: tier === 'PREMIUM',
  videoPost: tier !== 'FREE',
});

const PACKAGES: readonly SubscriptionPackage[] = [
  {
    code: 'FREE',
    name: 'Free',
    tier: 'FREE',
    price: '0',
    currency: 'VND',
    durationDays: null,
    purchasable: false,
    ...limits('FREE'),
  },
  {
    code: 'PRO_MONTHLY',
    name: 'Pro (monthly)',
    tier: 'PRO',
    price: '199000',
    currency: 'VND',
    durationDays: 30,
    purchasable: true,
    ...limits('PRO'),
  },
  {
    code: 'PREMIUM_MONTHLY',
    name: 'Premium (monthly)',
    tier: 'PREMIUM',
    price: '399000',
    currency: 'VND',
    durationDays: 30,
    purchasable: true,
    ...limits('PREMIUM'),
  },
];

/**
 * DEVELOPMENT ONLY. Scripted billing (UC-42, T-093 purchase flow): the
 * Trader starts on FREE; an order goes to a sandbox "gateway" whose return to
 * the result page the end-to-end test plays, and the payment notification
 * (IPN) is taken as arrived on the first read of the order there, which then
 * reads PENDING once and PAID after, as the page's polling would see it.
 */
export function createDevelopmentSubscription(
  now: () => number = Date.now,
): SubscriptionService {
  const orders = new Map<string, SubscriptionOrder>();
  const reads = new Map<string, number>();
  let current: CurrentSubscription = {
    tier: 'FREE',
    packageCode: null,
    packageName: null,
    startAt: null,
    endAt: null,
    carriedValueVnd: null,
    bonusDays: null,
  };
  const pause = () => new Promise((resolve) => setTimeout(resolve, 120));
  const packageOf = (code: string) => {
    const found = PACKAGES.find((item) => item.code === code);
    if (!found || !found.purchasable) refuse(400, 'VALIDATION_FAILED', 'MSG15');
    return found;
  };
  const quoteOf = (code: string) => {
    const item = packageOf(code);
    const start = now();
    return {
      packageCode: item.code,
      orderType:
        current.tier === 'FREE'
          ? ('NEW' as const)
          : current.packageCode === item.code
            ? ('RENEW' as const)
            : ('UPGRADE' as const),
      amount: item.price,
      currency: item.currency,
      carriedValueVnd: '0',
      bonusDays: 0,
      startAt: new Date(start).toISOString(),
      endAt: new Date(start + (item.durationDays ?? 0) * DAY).toISOString(),
    };
  };
  return {
    async packages() {
      await pause();
      return PACKAGES;
    },
    async gateways() {
      await pause();
      return [
        { code: 'SEPAY', enabled: true },
        { code: 'MOMO', enabled: true },
      ];
    },
    async quote(packageCode) {
      await pause();
      return quoteOf(packageCode);
    },
    async createOrder(packageCode, gateway) {
      await pause();
      const quote = quoteOf(packageCode);
      const item = packageOf(packageCode);
      const orderCode = `CPDEV${String(orders.size + 1).padStart(6, '0')}`;
      const order: SubscriptionOrder = {
        orderCode,
        packageCode: item.code,
        packageName: item.name,
        orderType: quote.orderType,
        amount: quote.amount,
        currency: quote.currency,
        gateway,
        status: 'PENDING',
        createdAt: new Date(now()).toISOString(),
        expiresAt: new Date(now() + 15 * 60_000).toISOString(),
        paidAt: null,
      };
      orders.set(orderCode, order);
      return {
        order,
        // A sandbox gateway that never resolves: the end-to-end test stops the
        // browser there and returns to the result page, as the gateway would.
        checkout: {
          method: 'GET',
          url: `https://sandbox.gateway.invalid/pay?orderCode=${orderCode}`,
          fields: {},
        },
      };
    },
    async orders({ page, pageSize }) {
      await pause();
      const items = [...orders.values()].reverse();
      return {
        items: items.slice(page * pageSize, (page + 1) * pageSize),
        page,
        pageSize,
        total: items.length,
      };
    },
    async order(orderCode) {
      await pause();
      const found = orders.get(orderCode);
      if (!found) refuse(404, 'RESOURCE_NOT_FOUND', 'MSG41');
      const read = (reads.get(orderCode) ?? 0) + 1;
      reads.set(orderCode, read);
      if (found.status === 'PENDING' && read > 1) {
        const item = packageOf(found.packageCode);
        const paid: SubscriptionOrder = {
          ...found,
          status: 'PAID',
          paidAt: new Date(now()).toISOString(),
        };
        orders.set(orderCode, paid);
        current = {
          tier: item.tier,
          packageCode: item.code,
          packageName: item.name,
          startAt: paid.paidAt,
          endAt: new Date(now() + (item.durationDays ?? 0) * DAY).toISOString(),
          carriedValueVnd: '0',
          bonusDays: 0,
        };
        return paid;
      }
      return found;
    },
    async current() {
      await pause();
      return current;
    },
  };
}
