import { FlaskConical } from 'lucide-react';
import { useCopy } from '../../../hooks/use-copy';
import { errorText } from '../../../i18n/messages';
import { usePaperAccount } from '../hooks/use-paper-account';

/**
 * Shown on every demo trading screen and never dismissable: virtual funds,
 * nothing reaches an exchange. Also says whether the demo account is ready.
 */
export function DemoTradingBanner() {
  const copy = useCopy();
  const p = copy.paper;
  const account = usePaperAccount();
  return (
    <div
      role="note"
      className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-warning-line bg-warning-soft px-3 py-2 text-xs text-warning"
    >
      <FlaskConical size={14} aria-hidden="true" className="shrink-0" />
      <strong className="font-semibold">{p.banner}</strong>
      <span role="status" className="text-fg-2 sm:ml-auto">
        {p.account}:{' '}
        {account.isPending
          ? p.accountOpening
          : account.isError
            ? errorText(copy, account.error)
            : p.accountReady}
      </span>
    </div>
  );
}
