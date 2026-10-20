import type {
  AlertsService,
  WatchlistService,
} from '../services/api/contracts';
import { ServiceError } from '../services/api/errors';
import type {
  Alert,
  AlertRule,
  PlanEntitlements,
  PlanFeature,
  Session,
  WatchlistItem,
} from '../types/domain';
import { devPairs } from './fixtures/market';
import { devAlertSeeds, devWatchlistSeeds } from './fixtures/watchlist';

/**
 * DEVELOPMENT ONLY. In-memory `/watchlist/**` and `/alerts/**` with the
 * backend's answers: MSG26 with the alert count before a removal (D-76),
 * the rule table of `AlertRuleValidator` as field errors (MSG01 / MSG15),
 * plan features (MSG29), `ACTIVE_ALERT_MAX` and `WATCHLIST_MAX` (MSG27),
 * MSG45 and the status transitions (MSG43). A pair is added by the id of
 * the development market lists, and an alert on a pair not watched yet
 * adds its row first (BR-16). Nothing is evaluated: trigger counts are
 * scripted. A reload restores the fixture.
 */
function refuse(
  status: number,
  code: string,
  messageCode: string,
  messageArgs: readonly string[] = [],
  fieldErrors: Readonly<Record<string, string>> = {},
): never {
  throw new ServiceError(
    'Development watchlist refusal.',
    'HTTP_ERROR',
    status,
    {
      status,
      code,
      messageCode,
      messageArgs,
      fieldErrors,
    },
  );
}

const pause = (signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, 150);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(signal.reason);
    });
  });

const MAX_EXPIRY_MS = 90 * 24 * 3_600_000;
const DECIMAL = /^-?\d{1,16}(\.\d{1,12})?$/;

/** The rule table of fe-guide `watchlist.md` (`AlertRuleValidator`). */
function ruleErrors(rule: AlertRule, now: number): Record<string, string> {
  const errors: Record<string, string> = {};
  const threshold = rule.threshold;
  const number =
    threshold !== null && DECIMAL.test(threshold) ? Number(threshold) : null;
  if (threshold !== null && number === null) errors.threshold = 'MSG15';
  if (rule.type === 'PRICE') {
    if (rule.indicator !== null) errors.indicator = 'MSG01';
    if (rule.timeframe !== null) errors.timeframe = 'MSG01';
    if (threshold === null) errors.threshold = 'MSG01';
    else if (number !== null && number <= 0) errors.threshold = 'MSG15';
  } else {
    const indicator = rule.indicator;
    if (indicator === null) errors.indicator = 'MSG01';
    else if (indicator === 'RSI_14') {
      if (rule.timeframe === null) errors.timeframe = 'MSG01';
      if (threshold === null) errors.threshold = 'MSG01';
      else if (number !== null && (number < 0 || number > 100))
        errors.threshold = 'MSG15';
    } else if (indicator === 'MACD_CROSS' || indicator === 'EMA_CROSS') {
      if (rule.timeframe === null) errors.timeframe = 'MSG01';
      if (threshold !== null) errors.threshold = 'MSG01';
      if (rule.condition !== 'CROSS_ABOVE' && rule.condition !== 'CROSS_BELOW')
        errors.condition = 'MSG01';
    } else {
      if (rule.timeframe !== null) errors.timeframe = 'MSG01';
      if (threshold === null) errors.threshold = 'MSG01';
      if (rule.market !== 'futures') errors.market = 'MSG01';
    }
  }
  if (rule.triggerMode === 'EVERY_TIME' && rule.cooldownMinutes === null)
    errors.cooldownMinutes = 'MSG01';
  if (rule.cooldownMinutes !== null && rule.cooldownMinutes < 1)
    errors.cooldownMinutes = 'MSG15';
  if (rule.expiresAt !== null) {
    const at = Date.parse(rule.expiresAt);
    if (!(at > now && at <= now + MAX_EXPIRY_MS)) errors.expiresAt = 'MSG15';
  }
  return errors;
}

function featuresOf(rule: AlertRule): PlanFeature[] {
  const needed: PlanFeature[] = [];
  if (rule.type === 'INDICATOR') needed.push('INDICATOR_ALERT');
  if (rule.market === 'futures') needed.push('FUTURES_ANALYSIS');
  if (rule.notifyEmail || rule.notifyPush)
    needed.push('EXTERNAL_ALERT_CHANNELS');
  return needed;
}

export function createDevelopmentWatchlist(
  session: () => Promise<Session | null>,
  now: () => number = Date.now,
): { watchlist: WatchlistService; alerts: AlertsService } {
  const rows = new Map(
    devWatchlistSeeds(now()).map((item) => [item.id, item] as const),
  );
  const alerts = new Map(
    devAlertSeeds(now(), [...rows.values()]).map(
      (alert) => [alert.id, alert] as const,
    ),
  );
  let sequence = 100;

  const plan = async (): Promise<PlanEntitlements | null> => {
    const entitlements = (await session())?.entitlements;
    return entitlements && entitlements !== 'unknown' ? entitlements : null;
  };
  const withCounts = (item: WatchlistItem): WatchlistItem => ({
    ...item,
    activeAlerts: [...alerts.values()].filter(
      (alert) => alert.watchlistId === item.id && alert.status === 'ACTIVE',
    ).length,
  });
  const ordered = () =>
    [...rows.values()]
      .sort(
        (a, b) =>
          a.sortOrder - b.sortOrder ||
          Date.parse(a.addedAt) - Date.parse(b.addedAt),
      )
      .map(withCounts);
  const findRow = (id: string) =>
    rows.get(id) ?? refuse(404, 'RESOURCE_NOT_FOUND', 'MSG41');
  const findAlert = (id: string) =>
    alerts.get(id) ?? refuse(404, 'RESOURCE_NOT_FOUND', 'MSG41');

  const limitReached = (
    entitlements: PlanEntitlements | null,
    key: 'WATCHLIST_MAX' | 'ACTIVE_ALERT_MAX',
    count: number,
    items: string,
  ) => {
    const max = entitlements?.limits[key];
    if (typeof max === 'number' && count >= max)
      refuse(409, 'PLAN_LIMIT_REACHED', 'MSG27', [
        String(max),
        items,
        entitlements?.tier ?? '',
      ]);
  };
  /** A new row for a pair of the market lists, not stored yet; MSG41 otherwise. */
  let rowSequence = 100;
  const newRow = (pairId: string): WatchlistItem => {
    const on = (market: 'spot' | 'futures') =>
      devPairs(market).find((pair) => pair.pairId === pairId);
    const pair = on('spot') ?? on('futures');
    if (!pair) return refuse(404, 'RESOURCE_NOT_FOUND', 'MSG41');
    const last = Math.max(
      -1,
      ...[...rows.values()].map((row) => row.sortOrder),
    );
    return {
      id: `0199a1b2-0000-7000-8000-${String(rowSequence++).padStart(12, '0')}`,
      pairId,
      symbol: pair.symbol,
      spotListed: Boolean(on('spot')),
      futuresListed: Boolean(on('futures')),
      label: null,
      note: null,
      sortOrder: last + 1,
      activeAlerts: 0,
      addedAt: new Date(now()).toISOString(),
    };
  };
  const activeCount = () =>
    [...alerts.values()].filter((alert) => alert.status === 'ACTIVE').length;

  /** Field rules (400) → plan features (403) → pair listed (404). */
  const check = async (rule: AlertRule, item: WatchlistItem) => {
    const errors = ruleErrors(rule, now());
    if (Object.keys(errors).length)
      refuse(400, 'VALIDATION_FAILED', 'MSG01', [], errors);
    const entitlements = await plan();
    const missing = featuresOf(rule).find(
      (feature) => entitlements && !entitlements.features.includes(feature),
    );
    if (missing) refuse(403, 'PLAN_FEATURE_NOT_INCLUDED', 'MSG29', ['PRO']);
    const listed =
      rule.market === 'spot' ? item.spotListed : item.futuresListed;
    if (!listed) refuse(404, 'RESOURCE_NOT_FOUND', 'MSG41');
    return entitlements;
  };
  const save = (alert: Alert) => {
    alerts.set(alert.id, alert);
    return alert;
  };

  const watchlist: WatchlistService = {
    async get(signal) {
      await pause(signal);
      const entitlements = await plan();
      return {
        items: ordered(),
        limit: entitlements?.limits.WATCHLIST_MAX ?? null,
      };
    },
    async add(pairId) {
      await pause();
      const existing = [...rows.values()].find(
        (item) => item.pairId === pairId,
      );
      if (existing)
        refuse(409, 'WATCHLIST_PAIR_ALREADY_WATCHED', 'MSG45', [
          existing.symbol,
        ]);
      const row = newRow(pairId);
      limitReached(await plan(), 'WATCHLIST_MAX', rows.size, 'watchlist items');
      rows.set(row.id, row);
      return withCounts(row);
    },
    async update(id, update) {
      await pause();
      const item = findRow(id);
      const errors: Record<string, string> = {};
      if ((update.label?.length ?? 0) > 100) errors.label = 'MSG01';
      if ((update.note?.length ?? 0) > 1000) errors.note = 'MSG01';
      const order = update.sortOrder;
      if (order !== undefined && (order < 0 || order > 10_000))
        errors.sortOrder = 'MSG15';
      if (Object.keys(errors).length)
        refuse(400, 'VALIDATION_FAILED', 'MSG01', [], errors);
      const next: WatchlistItem = {
        ...item,
        label:
          update.label === undefined ? item.label : update.label.trim() || null,
        note:
          update.note === undefined ? item.note : update.note.trim() || null,
        sortOrder: order ?? item.sortOrder,
      };
      rows.set(id, next);
      return withCounts(next);
    },
    async remove(id, confirmedAlerts) {
      await pause();
      const item = findRow(id);
      const own = [...alerts.values()].filter(
        (alert) => alert.watchlistId === id,
      );
      if (own.length > 0 && confirmedAlerts !== own.length)
        refuse(400, 'WATCHLIST_REMOVAL_CONFIRMATION_REQUIRED', 'MSG26', [
          item.symbol,
          String(own.length),
        ]);
      for (const alert of own) alerts.delete(alert.id);
      rows.delete(id);
    },
  };

  const service: AlertsService = {
    async list({ status, type, page, pageSize }, signal) {
      await pause(signal);
      const items = [...alerts.values()]
        .filter((alert) => !status || alert.status === status)
        .filter((alert) => !type || alert.type === type)
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
      return {
        items: items.slice((page - 1) * pageSize, page * pageSize),
        page,
        pageSize,
        total: items.length,
      };
    },
    async create(pairId, rule) {
      await pause();
      const watched = [...rows.values()].find((row) => row.pairId === pairId);
      // A pair not watched yet gets its row with the alert, or neither (BR-16).
      const item = watched ?? newRow(pairId);
      const entitlements = await check(rule, item);
      if (!watched)
        limitReached(
          entitlements,
          'WATCHLIST_MAX',
          rows.size,
          'watchlist items',
        );
      limitReached(
        entitlements,
        'ACTIVE_ALERT_MAX',
        activeCount(),
        'active alerts',
      );
      if (!watched) rows.set(item.id, item);
      return save({
        ...rule,
        id: `0199a3d4-0000-7000-8000-000000000${sequence++}`,
        watchlistId: item.id,
        pairId,
        symbol: item.symbol,
        status: 'ACTIVE',
        triggerCount: 0,
        lastTriggeredAt: null,
        createdAt: new Date(now()).toISOString(),
      });
    },
    async update(id, rule) {
      await pause();
      const alert = findAlert(id);
      const entitlements = await check(rule, findRow(alert.watchlistId));
      const reactivates =
        alert.status === 'TRIGGERED' || alert.status === 'EXPIRED';
      if (reactivates)
        limitReached(
          entitlements,
          'ACTIVE_ALERT_MAX',
          activeCount(),
          'active alerts',
        );
      return save({
        ...alert,
        ...rule,
        status: reactivates ? 'ACTIVE' : alert.status,
      });
    },
    async remove(id) {
      await pause();
      findAlert(id);
      alerts.delete(id);
    },
    async pause(id) {
      await pause();
      const alert = findAlert(id);
      if (alert.status !== 'ACTIVE')
        refuse(409, 'ALERT_STATUS_TRANSITION_INVALID', 'MSG43');
      return save({ ...alert, status: 'PAUSED' });
    },
    async resume(id) {
      await pause();
      const alert = findAlert(id);
      if (alert.status !== 'PAUSED')
        refuse(409, 'ALERT_STATUS_TRANSITION_INVALID', 'MSG43');
      if (alert.expiresAt && Date.parse(alert.expiresAt) <= now())
        refuse(400, 'VALIDATION_FAILED', 'MSG15', [], { expiresAt: 'MSG15' });
      const entitlements = await check(alert, findRow(alert.watchlistId));
      limitReached(
        entitlements,
        'ACTIVE_ALERT_MAX',
        activeCount(),
        'active alerts',
      );
      return save({ ...alert, status: 'ACTIVE' });
    },
  };

  return { watchlist, alerts: service };
}
