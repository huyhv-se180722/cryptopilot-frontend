import { AlertTriangle, Ban } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../hooks/use-auth';
import { formatCopy, useCopy } from '../../hooks/use-copy';
import { classNames } from '../../utils/class-names';
import type { AccountStatus } from '../../types/domain';

/** Figma Suspended / Banned screens with the SRS MSG10 text. */
export function AccountBlockedScreen({
  status,
}: {
  status: Exclude<AccountStatus, 'active'>;
}) {
  const copy = useCopy();
  const auth = useAuth();
  const banned = status === 'banned';
  const Icon = banned ? Ban : AlertTriangle;
  return (
    <div className="flex min-h-[calc(100dvh-var(--cp-banner-h))] flex-col items-center justify-center gap-5 px-4">
      <div
        className={classNames(
          'flex size-16 items-center justify-center rounded-full border',
          banned
            ? 'border-negative-line bg-negative-soft text-negative'
            : 'border-warning-line bg-warning-soft text-warning',
        )}
      >
        <Icon size={28} aria-hidden="true" />
      </div>
      <div className="max-w-[400px] text-center">
        <h1 className="mb-2 text-xl font-semibold">
          {banned ? copy.blocked.bannedTitle : copy.blocked.lockedTitle}
        </h1>
        <p className="text-sm leading-relaxed text-muted-dim">
          {formatCopy(copy.messages.MSG10, {
            status: banned
              ? copy.blocked.statusBanned
              : copy.blocked.statusLocked,
          })}
        </p>
      </div>
      <Button variant="secondary" onClick={() => void auth.logout()}>
        {copy.nav.signOut}
      </Button>
    </div>
  );
}
