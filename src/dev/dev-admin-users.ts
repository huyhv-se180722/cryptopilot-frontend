import type { AdminUserService } from '../services/api/contracts';
import { ServiceError } from '../services/api/errors';
import { USERS_PAGE_SIZE } from '../services/api/admin-users';
import type {
  AccountAction,
  AccountRole,
  AccountStatus,
  AdminUserDetail,
  AdminUserSummary,
  AuditEntry,
  PlanTier,
  Session,
} from '../types/domain';

/**
 * DEVELOPMENT ONLY. In-memory `/admin/users/**` for SCR-34 and SCR-35 with
 * the backend's refusals (409 ACCOUNT_STATUS_TRANSITION_INVALID, MSG39):
 * a change to one's own account, locking, banning or demoting the last
 * active administrator, unlocking an account that is not locked, locking
 * one that is not active and banning a banned one; an unknown account is
 * MSG41. 45 scripted accounts; a reload restores them.
 */
function refuse(status: number, code: string, messageCode: string): never {
  throw new ServiceError('Development account refusal.', 'HTTP_ERROR', status, {
    status,
    code,
    messageCode,
    messageArgs: [],
    fieldErrors: {},
  });
}
const refused = () => refuse(409, 'ACCOUNT_STATUS_TRANSITION_INVALID', 'MSG39');

const NAMES = [
  'Alex Morgan',
  'Jamie Chen',
  'Maria Santos',
  'David Park',
  'Sarah Williams',
  'Omar Hassan',
  'Lisa Tanaka',
  'Carlos Ruiz',
  'Priya Sharma',
];
const PLANS: readonly PlanTier[] = ['FREE', 'PRO', 'PREMIUM'];
const ACTIONS: Readonly<Record<AccountAction, string>> = {
  lock: 'ACCOUNT_LOCKED',
  unlock: 'ACCOUNT_UNLOCKED',
  ban: 'ACCOUNT_BANNED',
};
const uuid = (n: number) =>
  `0199a0f0-0000-7000-8000-${String(n).padStart(12, '0')}`;

function seed(): AdminUserSummary[] {
  const day = Date.UTC(2026, 9, 24, 9);
  const admins: AdminUserSummary[] = [
    {
      userId: 'dev-admin',
      email: 'admin@dev.local',
      displayName: 'Dev Admin',
      role: 'Admin',
      status: 'active',
      plan: 'FREE',
      emailVerified: true,
      lastLoginAt: new Date(day).toISOString(),
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
      userId: uuid(900),
      email: 'second.admin@cryptopilot.invalid',
      displayName: 'Second Admin',
      role: 'Admin',
      status: 'active',
      plan: 'FREE',
      emailVerified: true,
      lastLoginAt: null,
      createdAt: '2026-01-02T00:00:00.000Z',
    },
  ];
  const traders = Array.from({ length: 43 }, (_, i): AdminUserSummary => {
    const name = NAMES[i % NAMES.length] as string;
    const status: AccountStatus =
      i % 17 === 5 ? 'banned' : i % 11 === 3 ? 'locked' : 'active';
    return {
      userId: uuid(i + 1),
      email: `${name.toLowerCase().replace(' ', '.')}${i + 1}@example.test`,
      displayName: i % 13 === 7 ? null : name,
      role: 'Trader',
      status,
      plan: PLANS[i % 3] as PlanTier,
      emailVerified: i % 9 !== 4,
      lastLoginAt:
        i % 6 === 2 ? null : new Date(day - i * 7_200_000).toISOString(),
      createdAt: new Date(day - (i + 2) * 86_400_000).toISOString(),
    };
  });
  return [...admins, ...traders].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}

export function createDevelopmentAdminUsers(
  session: () => Promise<Session | null> = async () => null,
  now: () => number = Date.now,
): AdminUserService {
  const accounts = new Map(seed().map((a) => [a.userId, a]));
  const audits = new Map<string, AuditEntry[]>();
  const pause = () => new Promise((resolve) => setTimeout(resolve, 120));

  const found = (userId: string) =>
    accounts.get(userId) ?? refuse(404, 'RESOURCE_NOT_FOUND', 'MSG41');
  const detail = (account: AdminUserSummary): AdminUserDetail => {
    const n = Number(account.userId.slice(-3)) || 0;
    return {
      account,
      tradingStyle: account.role === 'Trader' ? 'SWING' : null,
      riskProfile: account.role === 'Trader' ? 'BALANCED' : null,
      activity: { plans: n % 7, posts: n % 4, trades: n % 5 },
      recentAudit: audits.get(account.userId) ?? [],
    };
  };
  const otherActiveAdmins = (userId: string) =>
    [...accounts.values()].filter(
      (a) => a.role === 'Admin' && a.status === 'active' && a.userId !== userId,
    ).length;

  async function change(
    userId: string,
    next: Partial<AdminUserSummary>,
    action: string,
    reason: string,
  ) {
    const account = found(userId);
    const actor = (await session())?.user.id ?? null;
    const updated = { ...account, ...next };
    accounts.set(userId, updated);
    const values = (a: AdminUserSummary, extra: object = {}) =>
      JSON.stringify({
        status: a.status.toUpperCase(),
        role: a.role.toUpperCase(),
        ...extra,
      });
    audits.set(
      userId,
      [
        {
          recordedAt: new Date(now()).toISOString(),
          actorId: actor,
          action,
          oldValue: values(account),
          newValue: values(updated, { reason }),
          ipAddress: '127.0.0.1',
        },
        ...(audits.get(userId) ?? []),
      ].slice(0, 20),
    );
    return detail(updated);
  }

  async function requireNotSelf(userId: string) {
    if ((await session())?.user.id === userId) refused();
  }
  const requireAnotherAdmin = (account: AdminUserSummary) => {
    if (
      account.role === 'Admin' &&
      account.status === 'active' &&
      otherActiveAdmins(account.userId) === 0
    )
      refused();
  };

  return {
    async search(query) {
      await pause();
      const q = query.q?.trim().toLowerCase();
      const rows = [...accounts.values()].filter(
        (a) =>
          (!q ||
            a.email.toLowerCase().includes(q) ||
            (a.displayName ?? '').toLowerCase().includes(q)) &&
          (!query.role || a.role === query.role) &&
          (!query.status || a.status === query.status) &&
          (!query.plan || a.plan === query.plan),
      );
      const start = (query.page - 1) * USERS_PAGE_SIZE;
      return {
        items: rows.slice(start, start + USERS_PAGE_SIZE),
        page: query.page,
        pageSize: USERS_PAGE_SIZE,
        total: rows.length,
      };
    },
    async get(userId) {
      await pause();
      return detail(found(userId));
    },
    async act(userId, action, reason) {
      await pause();
      const account = found(userId);
      if (action === 'unlock') {
        if (account.status !== 'locked') refused();
        return change(userId, { status: 'active' }, ACTIONS[action], reason);
      }
      await requireNotSelf(userId);
      if (action === 'lock' && account.status !== 'active') refused();
      if (action === 'ban' && account.status === 'banned') refused();
      requireAnotherAdmin(account);
      return change(
        userId,
        { status: action === 'lock' ? 'locked' : 'banned' },
        ACTIONS[action],
        reason,
      );
    },
    async changeRole(userId, role: AccountRole, reason) {
      await pause();
      const account = found(userId);
      await requireNotSelf(userId);
      if (role === 'Trader') requireAnotherAdmin(account);
      return change(userId, { role }, 'ROLE_CHANGED', reason);
    },
  };
}
