import type {
  CheckoutForm,
  CreatedOrder,
  CurrentSubscription,
  OrderQuote,
  OrderStatus,
  OrderType,
  PaymentGateway,
  PaymentGatewayCode,
  PlanTier,
  SubscriptionOrder,
  SubscriptionOrderPage,
  SubscriptionPackage,
} from '../../types/domain';
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

const TIERS: readonly PlanTier[] = ['FREE', 'PRO', 'PREMIUM'];
const GATEWAYS: readonly PaymentGatewayCode[] = ['MOMO', 'SEPAY', 'VNPAY'];
const TYPES: readonly OrderType[] = ['NEW', 'RENEW', 'UPGRADE'];
const STATUSES: readonly OrderStatus[] = [
  'PENDING',
  'PAID',
  'FAILED',
  'EXPIRED',
];

function nullableInteger(value: unknown, name: string): number | null {
  return value === null || value === undefined ? null : integer(value, name);
}

function decodePackage(item: unknown): SubscriptionPackage {
  const v = record(item, 'package');
  return {
    code: text(v.code, 'code'),
    name: text(v.name, 'name'),
    tier: oneOf(TIERS, v.tier, 'tier'),
    price: decimal(v.price, 'price'),
    currency: text(v.currency, 'currency'),
    durationDays: nullableInteger(v.durationDays, 'durationDays'),
    purchasable: flag(v.purchasable, 'purchasable'),
    futuresAnalysis: flag(v.futuresAnalysis, 'futuresAnalysis'),
    scoreComponents: flag(v.scoreComponents, 'scoreComponents'),
    activePlanMax: nullableInteger(v.activePlanMax, 'activePlanMax'),
    watchlistMax: nullableInteger(v.watchlistMax, 'watchlistMax'),
    activeAlertMax: nullableInteger(v.activeAlertMax, 'activeAlertMax'),
    indicatorAlert: flag(v.indicatorAlert, 'indicatorAlert'),
    externalAlertChannels: flag(
      v.externalAlertChannels,
      'externalAlertChannels',
    ),
    advancedPerformance: flag(v.advancedPerformance, 'advancedPerformance'),
    newsAiInsight: flag(v.newsAiInsight, 'newsAiInsight'),
    aiDailyQuota: integer(v.aiDailyQuota, 'aiDailyQuota'),
    aiPerformanceContext: flag(v.aiPerformanceContext, 'aiPerformanceContext'),
    videoPost: flag(v.videoPost, 'videoPost'),
  };
}

export function decodePackages(body: unknown): readonly SubscriptionPackage[] {
  return list(body, 'packages').map(decodePackage);
}

export function decodeGateways(body: unknown): readonly PaymentGateway[] {
  return list(body, 'gateways').map((item) => {
    const v = record(item, 'gateway');
    return {
      code: oneOf(GATEWAYS, v.code, 'code'),
      enabled: flag(v.enabled, 'enabled'),
    };
  });
}

export function decodeQuote(body: unknown): OrderQuote {
  const v = record(body);
  return {
    packageCode: text(v.packageCode, 'packageCode'),
    orderType: oneOf(TYPES, v.orderType, 'orderType'),
    amount: decimal(v.amount, 'amount'),
    currency: text(v.currency, 'currency'),
    carriedValueVnd: decimal(v.carriedValueVnd, 'carriedValueVnd'),
    bonusDays: integer(v.bonusDays, 'bonusDays'),
    startAt: instant(v.startAt, 'startAt'),
    endAt: instant(v.endAt, 'endAt'),
  };
}

export function decodeOrder(body: unknown): SubscriptionOrder {
  const v = record(body, 'order');
  return {
    orderCode: text(v.orderCode, 'orderCode'),
    packageCode: text(v.packageCode, 'packageCode'),
    packageName: text(v.packageName, 'packageName'),
    orderType: oneOf(TYPES, v.orderType, 'orderType'),
    amount: decimal(v.amount, 'amount'),
    currency: text(v.currency, 'currency'),
    gateway: oneOf(GATEWAYS, v.gateway, 'gateway'),
    status: oneOf(STATUSES, v.status, 'status'),
    createdAt: instant(v.createdAt, 'createdAt'),
    expiresAt: instant(v.expiresAt, 'expiresAt'),
    paidAt: nullableInstant(v.paidAt, 'paidAt'),
  };
}

export function decodeOrderPage(body: unknown): SubscriptionOrderPage {
  const v = record(body);
  return {
    items: list(v.items, 'items').map(decodeOrder),
    page: integer(v.page, 'page'),
    pageSize: integer(v.pageSize, 'pageSize'),
    total: integer(v.total, 'total'),
  };
}

function decodeCheckout(body: unknown): CheckoutForm {
  const v = record(body, 'checkout');
  const url = text(v.url, 'url');
  if (!/^https:\/\//.test(url)) throw new Error('checkout url must be https');
  const raw = record(v.fields ?? {}, 'fields');
  const fields: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value !== 'string') throw new Error(key + ' must be a string');
    fields[key] = value;
  }
  return { method: oneOf(['GET', 'POST'], v.method, 'method'), url, fields };
}

export function decodeCreatedOrder(body: unknown): CreatedOrder {
  const v = record(body);
  return { order: decodeOrder(v.order), checkout: decodeCheckout(v.checkout) };
}

export function decodeCurrentSubscription(body: unknown): CurrentSubscription {
  const v = record(body);
  return {
    tier: oneOf(TIERS, v.tier, 'tier'),
    packageCode: nullableText(v.packageCode, 'packageCode'),
    packageName: nullableText(v.packageName, 'packageName'),
    startAt: nullableInstant(v.startAt, 'startAt'),
    endAt: nullableInstant(v.endAt, 'endAt'),
    carriedValueVnd: nullableDecimal(v.carriedValueVnd, 'carriedValueVnd'),
    bonusDays: nullableInteger(v.bonusDays, 'bonusDays'),
  };
}
