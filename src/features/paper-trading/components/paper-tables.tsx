import type { ReactNode } from 'react';
import { ErrorState } from '../../../components/feedback/States';
import { Skeleton } from '../../../components/ui/Skeleton';
import { buttonClassName } from '../../../components/ui/button-styles';
import { useCopy } from '../../../hooks/use-copy';
import { formatCopy } from '../../../i18n/copy';
import { errorText } from '../../../i18n/messages';
import { ServiceError } from '../../../services/api/errors';
import type { PaperPage } from '../../../types/domain';
import { usePaperAccount } from '../hooks/use-paper-account';

interface QueryLike {
  isPending: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => unknown;
}

/**
 * Loading, error or content of a demo trading read. Every read waits for
 * the demo account, so while it cannot open its reason is shown instead
 * (e.g. not connected).
 */
export function PaperQueryState({
  query,
  children,
}: {
  query: QueryLike;
  children: () => ReactNode;
}) {
  const copy = useCopy();
  const account = usePaperAccount();
  const shown: QueryLike = account.isError ? account : query;
  if (shown.isError)
    return shown.error instanceof ServiceError &&
      shown.error.code === 'NOT_CONFIGURED' ? (
      <p className="py-8 text-center text-xs text-muted-dim">
        {errorText(copy, shown.error)}
      </p>
    ) : (
      <ErrorState
        message={errorText(copy, shown.error)}
        onRetry={() => void shown.refetch()}
      />
    );
  if (shown.isPending) return <Skeleton className="h-32 w-full" />;
  return <>{children()}</>;
}

/** "Previous · Page n of m · Next" under a paged table (CR-04). */
export function PaperPager({
  page,
  current,
  onChange,
}: {
  page: PaperPage<unknown> | undefined;
  current: number;
  onChange: (page: number) => void;
}) {
  const copy = useCopy();
  const pages = page ? Math.max(1, Math.ceil(page.total / page.pageSize)) : 1;
  if (pages <= 1) return null;
  return (
    <nav
      aria-label={formatCopy(copy.plan.pageOf, { page: current, pages })}
      className="mt-2 flex items-center justify-end gap-2 text-xs"
    >
      <button
        type="button"
        disabled={current <= 1}
        onClick={() => onChange(current - 1)}
        className={buttonClassName('ghost', 'sm')}
      >
        {copy.plan.previous}
      </button>
      <span className="text-muted-dim">
        {formatCopy(copy.plan.pageOf, { page: current, pages })}
      </span>
      <button
        type="button"
        disabled={current >= pages}
        onClick={() => onChange(current + 1)}
        className={buttonClassName('ghost', 'sm')}
      >
        {copy.plan.next}
      </button>
    </nav>
  );
}
