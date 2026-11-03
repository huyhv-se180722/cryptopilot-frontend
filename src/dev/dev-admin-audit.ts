import type { AdminAuditService } from '../services/api/contracts';
import { AUDIT_PAGE_SIZE } from '../services/api/admin-audit';
import { ServiceError } from '../services/api/errors';
import type {
  AuditActor,
  AuditLogEntry,
  AuditLogQuery,
  SystemEvent,
  SystemEventQuery,
  SystemHealth,
} from '../types/domain';

/**
 * DEVELOPMENT ONLY. A scripted SCR-44: 44 audit entries over the last
 * weeks by two administrators and the system, 9 system log rows and a
 * health panel with one service down and one degraded. Filters, paging and
 * the backwards period behave as the backend's (MSG15 on `from`); the
 * period is cut in UTC+7 business days.
 */
const MINUTE = 60_000;
const DAY = 86_400_000;
const ZONE_OFFSET = 7 * 60 * MINUTE;

const ADMINS: readonly AuditActor[] = [
  {
    id: 'dev-admin',
    email: 'admin@dev.local',
    displayName: 'Dev Admin',
    role: 'ADMIN',
  },
  {
    id: '0199a0f0-0000-7000-8000-00000000a002',
    email: 'moderator@cryptopilot.vn',
    displayName: 'Trần Minh Khoa',
    role: 'ADMIN',
  },
];

const TRADERS = [
  '0199a0f0-0000-7000-8000-000000000001',
  '0199a0f0-0000-7000-8000-000000000002',
  '0199a0f0-0000-7000-8000-000000000003',
];

const uuid = (n: number) =>
  `0199b1c2-${String(n).padStart(4, '0')}-7000-8000-${String(n).padStart(12, '0')}`;

function entries(now: number): AuditLogEntry[] {
  const list: AuditLogEntry[] = [];
  const add = (
    minutesAgo: number,
    actor: AuditActor | null,
    action: string,
    entityType: string | null,
    entityId: string | null,
    oldValue: AuditLogEntry['oldValue'],
    newValue: AuditLogEntry['newValue'],
  ) =>
    list.push({
      id: uuid(list.length + 1),
      recordedAt: new Date(now - minutesAgo * MINUTE).toISOString(),
      actor,
      action,
      entityType,
      entityId,
      ipAddress: actor ? '113.161.' + (20 + (list.length % 9)) + '.14' : null,
      oldValue,
      newValue,
    });
  const [lead, moderator] = ADMINS as [AuditActor, AuditActor];
  for (let i = 0; i < 9; i++) {
    const trader = TRADERS[i % TRADERS.length] as string;
    add(
      35 + i * 410,
      i % 2 ? moderator : lead,
      'ACCOUNT_LOCKED',
      'USER_ACCOUNT',
      trader,
      { status: 'ACTIVE' },
      { status: 'LOCKED', reason: 'Spam liên kết giới thiệu trong diễn đàn' },
    );
    add(
      20 + i * 410,
      lead,
      'ACCOUNT_UNLOCKED',
      'USER_ACCOUNT',
      trader,
      { status: 'LOCKED' },
      { status: 'ACTIVE', reason: 'Đã xác minh lại danh tính' },
    );
  }
  for (let i = 0; i < 8; i++)
    add(
      90 + i * 600,
      moderator,
      i % 3 ? 'POST_HIDDEN' : 'POST_REMOVED',
      'FORUM_POST',
      uuid(900 + i),
      { postStatus: 'PUBLISHED' },
      {
        postStatus: i % 3 ? 'HIDDEN' : 'REMOVED',
        reason: 'Kêu gọi mua bán, vi phạm quy định cộng đồng',
        reports: 3 + i,
      },
    );
  for (let i = 0; i < 8; i++)
    add(
      240 + i * 1440,
      lead,
      'CONFIGURATION_CHANGED',
      'SYSTEM_SETTING',
      null,
      { key: 'SPOT_TAKER_FEE', value: '0.0010' },
      { key: 'SPOT_TAKER_FEE', value: '0.00075' },
    );
  for (let i = 0; i < 6; i++)
    add(
      600 + i * 2000,
      null,
      'CONFIGURATION_CHANGED',
      'SUBSCRIPTION_ORDER',
      uuid(700 + i),
      { orderStatus: 'PENDING' },
      { orderStatus: 'EXPIRED' },
    );
  add(
    5,
    lead,
    'ROLE_CHANGED',
    'USER_ACCOUNT',
    TRADERS[2] as string,
    { role: 'TRADER' },
    { role: 'ADMIN', reason: 'Bổ sung người kiểm duyệt ca tối' },
  );
  add(3000, lead, 'CONFIGURATION_CREATED', 'CRYPTO_PAIR', uuid(800), null, {
    symbol: 'SOLUSDT',
    marketType: 'FUTURES',
    maxLeverage: 50,
  });
  add(
    3100,
    lead,
    'ACCOUNT_BANNED',
    'USER_ACCOUNT',
    TRADERS[1] as string,
    { status: 'ACTIVE' },
    { status: 'BANNED', reason: 'Lừa đảo người dùng khác qua tin nhắn' },
  );
  add(
    4000,
    moderator,
    'NEWS_ARTICLE_HIDDEN',
    'NEWS_ARTICLE',
    uuid(600),
    { hidden: false },
    { hidden: true, reason: 'Nguồn tin trùng lặp' },
  );
  return list.sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
}

function events(now: number): SystemEvent[] {
  const row = (
    n: number,
    minutesAgo: number,
    span: number,
    category: SystemEvent['category'],
    source: SystemEvent['source'],
    operation: string,
    errorType: string,
    message: string | null,
    occurrences: number,
    reference: string | null = null,
  ): SystemEvent => ({
    id: uuid(5000 + n),
    category,
    source,
    operation,
    errorType,
    message,
    reference,
    occurrences,
    firstSeenAt: new Date(now - (minutesAgo + span) * MINUTE).toISOString(),
    lastSeenAt: new Date(now - minutesAgo * MINUTE).toISOString(),
  });
  return [
    row(
      1,
      2,
      9,
      'EXTERNAL_API_FAILURE',
      'AI_SERVICE',
      'AiServiceClient.summarizeNews',
      'com.cryptopilot.ai.AiServiceException',
      'the AI Service did not answer in 20 s',
      14,
    ),
    row(
      2,
      8,
      0,
      'EXTERNAL_API_FAILURE',
      'NEWS_SOURCE',
      'RssClient.read',
      'com.cryptopilot.news.client.RssClientException',
      'https://cointelegraph.com/rss answered 503',
      1,
    ),
    row(
      3,
      26,
      4,
      'SYSTEM_ERROR',
      'APPLICATION',
      'POST /api/v1/plans',
      'java.lang.IllegalStateException',
      'no closed candle for BTCUSDT 4h',
      2,
      '0199b1c2-ef01-7000-8000-00000000beef',
    ),
    row(
      4,
      70,
      10,
      'EXTERNAL_API_FAILURE',
      'BINANCE_REST',
      'BinanceRestClient.klines',
      'com.cryptopilot.market.client.BinanceClientException',
      'FUTURES /fapi/v1/klines answered 429 after 3 tries',
      37,
    ),
    row(
      5,
      190,
      0,
      'SYSTEM_ERROR',
      'SCHEDULED_JOB',
      'CandleBackfillJob.run',
      'org.springframework.dao.QueryTimeoutException',
      'canceling statement due to statement timeout',
      1,
    ),
    row(
      6,
      600,
      8,
      'EXTERNAL_API_FAILURE',
      'MAIL',
      'SmtpEmailSender.send',
      'org.springframework.mail.MailSendException',
      'Mail server connection failed; nested exception is SocketTimeoutException',
      5,
    ),
    row(
      7,
      1500,
      0,
      'EXTERNAL_API_FAILURE',
      'MEDIA_STORAGE',
      'CloudinaryClient.describe',
      'com.cryptopilot.community.client.MediaStorageException',
      'Cloudinary did not describe posts/abc: 500 Internal Server Error',
      1,
    ),
    row(
      8,
      2900,
      3,
      'SYSTEM_ERROR',
      'APPLICATION',
      'GET /api/v1/journal',
      'java.lang.NullPointerException',
      null,
      3,
      '0199b1c2-ef02-7000-8000-00000000cafe',
    ),
    row(
      9,
      8000,
      0,
      'SYSTEM_ERROR',
      'SCHEDULED_JOB',
      'FundingSettlementJob.settle',
      'java.lang.ArithmeticException',
      'Division by zero',
      1,
    ),
  ];
}

/** The instant a business day (UTC+7) starts. */
const dayStart = (day: string) => Date.parse(day + 'T00:00:00Z') - ZONE_OFFSET;

function refuseBackwards(from?: string, to?: string) {
  if (from && to && from > to)
    throw new ServiceError('Development refusal.', 'HTTP_ERROR', 400, {
      status: 400,
      code: 'VALIDATION_FAILED',
      messageCode: 'MSG01',
      messageArgs: [],
      fieldErrors: { from: 'MSG15' },
    });
}

function inPeriod(iso: string, from?: string, to?: string) {
  const at = Date.parse(iso);
  return (!from || at >= dayStart(from)) && (!to || at < dayStart(to) + DAY);
}

function matches(entry: AuditLogEntry, query: Omit<AuditLogQuery, 'page'>) {
  const text = query.actor?.toLowerCase();
  return (
    (!text ||
      (entry.actor !== null &&
        ((entry.actor.email ?? '').toLowerCase().includes(text) ||
          (entry.actor.displayName ?? '').toLowerCase().includes(text)))) &&
    (!query.actorId || entry.actor?.id === query.actorId) &&
    (!query.actorType ||
      (query.actorType === 'SYSTEM') === (entry.actor === null)) &&
    (!query.actions?.length || query.actions.includes(entry.action)) &&
    (!query.entityType || entry.entityType === query.entityType) &&
    (!query.entityId || entry.entityId === query.entityId) &&
    inPeriod(entry.recordedAt, query.from, query.to)
  );
}

const csvCell = (value: string | null) =>
  value === null
    ? ''
    : /[",\n\r]/.test(value)
      ? '"' + value.replace(/"/g, '""') + '"'
      : value;

export function createDevelopmentAdminAudit(
  clock: () => number = Date.now,
): AdminAuditService {
  const start = clock();
  const log = entries(start);
  const failures = events(start);
  return {
    async auditLog(query: AuditLogQuery) {
      refuseBackwards(query.from, query.to);
      const found = log.filter((entry) => matches(entry, query));
      const first = (query.page - 1) * AUDIT_PAGE_SIZE;
      return {
        items: found.slice(first, first + AUDIT_PAGE_SIZE),
        page: query.page,
        pageSize: AUDIT_PAGE_SIZE,
        total: found.length,
        actorsTruncated: false,
      };
    },
    async exportAuditLog(query) {
      refuseBackwards(query.from, query.to);
      const lines = log
        .filter((entry) => matches(entry, query))
        .map((entry) =>
          [
            entry.recordedAt,
            entry.actor ? entry.actor.email : 'SYSTEM',
            entry.actor?.id ?? null,
            entry.action,
            entry.entityType,
            entry.entityId,
            entry.ipAddress,
            entry.oldValue === null ? null : JSON.stringify(entry.oldValue),
            entry.newValue === null ? null : JSON.stringify(entry.newValue),
          ]
            .map(csvCell)
            .join(','),
        );
      const csv =
        [
          'recordedAt,actorEmail,actorId,action,entityType,entityId,ipAddress,oldValue,newValue',
          ...lines,
        ].join('\r\n') + '\r\n';
      return { csv, actorsTruncated: false, truncated: false, matched: null };
    },
    async systemEvents(query: SystemEventQuery) {
      refuseBackwards(query.from, query.to);
      const found = failures.filter(
        (event) =>
          (!query.category || event.category === query.category) &&
          (!query.source || event.source === query.source) &&
          inPeriod(event.lastSeenAt, query.from, query.to),
      );
      const first = (query.page - 1) * AUDIT_PAGE_SIZE;
      return {
        items: found.slice(first, first + AUDIT_PAGE_SIZE),
        page: query.page,
        pageSize: AUDIT_PAGE_SIZE,
        total: found.length,
      };
    },
    async health(): Promise<SystemHealth> {
      const now = clock();
      const ago = (minutes: number) =>
        new Date(now - minutes * MINUTE).toISOString();
      return {
        checkedAt: new Date(now).toISOString(),
        recentWindowMinutes: 15,
        staleAfterMinutes: 5,
        services: [
          {
            source: 'BINANCE_REST',
            status: 'UP',
            lastSuccessAt: ago(0.2),
            lastFailureAt: ago(70),
            failures24h: 37,
            lastError: 'FUTURES /fapi/v1/klines answered 429 after 3 tries',
            bannedUntil: null,
          },
          {
            source: 'AI_SERVICE',
            status: 'DOWN',
            lastSuccessAt: ago(14),
            lastFailureAt: ago(2),
            failures24h: 14,
            lastError: 'the AI Service did not answer in 20 s',
            bannedUntil: null,
          },
          {
            source: 'NEWS_SOURCE',
            status: 'DEGRADED',
            lastSuccessAt: ago(3),
            lastFailureAt: ago(8),
            failures24h: 1,
            lastError: 'https://cointelegraph.com/rss answered 503',
            bannedUntil: null,
          },
          {
            source: 'MEDIA_STORAGE',
            status: 'UNKNOWN',
            lastSuccessAt: null,
            lastFailureAt: ago(1500),
            failures24h: 0,
            lastError: null,
            bannedUntil: null,
          },
          {
            source: 'MAIL',
            status: 'UP',
            lastSuccessAt: ago(42),
            lastFailureAt: ago(600),
            failures24h: 5,
            lastError: null,
            bannedUntil: null,
          },
        ],
        feeds: [
          {
            market: 'SPOT',
            latestCandleAt: ago(0.75),
            lagSeconds: 45,
            stale: false,
          },
          {
            market: 'FUTURES',
            latestCandleAt: ago(12),
            lagSeconds: 720,
            stale: true,
          },
        ],
      };
    },
  };
}
