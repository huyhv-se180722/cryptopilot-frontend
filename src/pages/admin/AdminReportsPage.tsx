import { useState } from 'react';
import { MessageSquare, ShieldCheck } from 'lucide-react';
import { EmptyState, ErrorState } from '../../components/feedback/States';
import { PageHeader } from '../../components/layout/PageHeader';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { ModerationCaseDialog } from '../../features/moderation/components/ModerationCaseDialog';
import { ModerationQueueTable } from '../../features/moderation/components/ModerationQueueTable';
import {
  QUEUE_PAGE_SIZE,
  useModerationQueue,
} from '../../features/moderation/hooks/use-moderation';
import { useCopy } from '../../hooks/use-copy';
import { formatCopy } from '../../i18n/copy';
import { errorText } from '../../i18n/messages';

/**
 * SCR-36 Report moderation (SRS 3.11.3, UC-43), from the Figma
 * "Community Moderation" screen: the posts with OPEN or REVIEWING reports,
 * gathered by post, reported longest ago first; Review opens the post and
 * its reports for one decision. The prototype's per-report rows and its
 * Pending / Resolved filter are not kept: the backend gathers reports by
 * post and lists only the open ones.
 */
export function AdminReportsPage() {
  const copy = useCopy();
  const m = copy.moderation;
  const [page, setPage] = useState(1);
  const [reviewing, setReviewing] = useState<string | null>(null);
  const queue = useModerationQueue(page);
  const total = queue.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / QUEUE_PAGE_SIZE));

  const body = queue.isPending ? (
    <div className="grid gap-2">
      {[0, 1, 2].map((k) => (
        <Skeleton key={k} className="h-12 w-full" />
      ))}
    </div>
  ) : queue.isError ? (
    <ErrorState
      message={errorText(copy, queue.error)}
      onRetry={() => void queue.refetch()}
    />
  ) : queue.data.items.length === 0 ? (
    <EmptyState icon={ShieldCheck} title={m.empty} description={m.emptyHint} />
  ) : (
    <>
      <ModerationQueueTable
        items={queue.data.items}
        onReview={(item) => setReviewing(item.post.id)}
      />
      {pages > 1 && (
        <div className="mt-3 flex items-center justify-end gap-2 text-xs text-muted-dim">
          <span>{formatCopy(m.pageOf, { page, pages })}</span>
          <Button
            variant="secondary"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            {m.previous}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={page >= pages}
            onClick={() => setPage((p) => p + 1)}
          >
            {m.next}
          </Button>
        </div>
      )}
    </>
  );

  return (
    <div className="w-full">
      <PageHeader
        size="sm"
        title={m.title}
        description={m.subtitle}
        actions={
          total > 0 ? (
            <Badge tone="warning">
              <MessageSquare size={11} aria-hidden="true" />
              {formatCopy(m.pending, { n: total })}
            </Badge>
          ) : undefined
        }
      />
      {body}
      <ModerationCaseDialog
        postId={reviewing}
        onClose={() => setReviewing(null)}
      />
    </div>
  );
}
