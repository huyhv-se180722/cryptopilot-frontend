import type { Tone } from '../../../components/ui/Badge';
import type {
  AccountStatus,
  AuditEntry,
  PlanTier,
} from '../../../types/domain';

export const statusTone: Record<AccountStatus, Tone> = {
  active: 'success',
  locked: 'warning',
  banned: 'danger',
};

export const planTone: Record<PlanTier, Tone> = {
  FREE: 'neutral',
  PRO: 'info',
  PREMIUM: 'success',
};

export const userPath = (userId: string) =>
  '/admin/users/' + encodeURIComponent(userId);

type Values = Readonly<Record<string, unknown>>;

/** The audited fields are JSON text; anything else shows as nothing changed. */
function parse(json: string | null): Values {
  if (!json) return {};
  try {
    const value: unknown = JSON.parse(json);
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Values)
      : {};
  } catch {
    return {};
  }
}

const shown = (value: unknown) =>
  typeof value === 'string' || typeof value === 'number'
    ? String(value)
    : value === null || value === undefined
      ? '—'
      : JSON.stringify(value);

/** The fields an entry changed (old → new) and the reason it records. */
export function describeChange(entry: AuditEntry) {
  const before = parse(entry.oldValue);
  const after = parse(entry.newValue);
  const fields = [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter((name) => name !== 'reason')
    .filter((name) => shown(before[name]) !== shown(after[name]))
    .map((name) => ({
      name,
      from: shown(before[name]),
      to: shown(after[name]),
    }));
  const reason = typeof after.reason === 'string' ? after.reason : null;
  return { fields, reason };
}
