import { Link, useSearchParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { ErrorState } from '../../components/feedback/States';
import { Skeleton } from '../../components/ui/Skeleton';
import { useCopy } from '../../hooks/use-copy';
import { errorText, messageText } from '../../i18n/messages';
import { ManualTradeForm } from '../../features/journal/components/ManualTradeForm';
import { useJournalEntry } from '../../features/journal/hooks/use-journal-entry';

/**
 * SCR-22 Record Manual Trade (UC-24) at `/journal/new`; `?edit=<id>`
 * replaces a manual trade (a simulated one is refused, BR-40).
 */
export function JournalManualPage() {
  const copy = useCopy();
  const j = copy.journal;
  const [params] = useSearchParams();
  const editId = params.get('edit') ?? '';
  const editing = useJournalEntry(editId);
  const entry = editId ? editing.data : undefined;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <Link
        to={editId ? `/journal/${editId}` : '/journal'}
        className="mb-3 inline-flex items-center gap-1 text-xs text-muted no-underline hover:text-fg-2"
      >
        <ChevronLeft size={13} aria-hidden="true" />
        {j.back}
      </Link>
      <header className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold text-fg">
          {editId ? j.manualEditTitle : j.manualTitle}
        </h1>
        <span className="rounded border border-line px-1.5 text-xs font-semibold text-muted">
          {copy.performance.sourceMANUAL}
        </span>
        <p className="w-full text-xs text-muted-dim">{j.manualSubtitle}</p>
      </header>
      {!editId ? (
        <ManualTradeForm />
      ) : editing.isPending ? (
        <Skeleton className="h-96 w-full" />
      ) : editing.missing ? (
        <p
          role="alert"
          className="rounded-xl border border-line bg-surface p-6 text-sm text-muted"
        >
          {messageText(copy, 'MSG41')}
        </p>
      ) : editing.isError || !entry ? (
        <ErrorState
          message={errorText(copy, editing.error)}
          onRetry={() => void editing.refetch()}
        />
      ) : entry.trade.source !== 'MANUAL' ? (
        <p
          role="alert"
          className="rounded-xl border border-line bg-surface p-6 text-sm text-muted"
        >
          {j.manualNotManual}
        </p>
      ) : (
        <ManualTradeForm key={entry.trade.id} entry={entry} />
      )}
    </div>
  );
}
