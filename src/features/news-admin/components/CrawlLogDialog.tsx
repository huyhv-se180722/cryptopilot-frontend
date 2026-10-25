import { useState } from 'react';
import { ErrorState } from '../../../components/feedback/States';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Dialog } from '../../../components/ui/Dialog';
import { Skeleton } from '../../../components/ui/Skeleton';
import { Table, type Column } from '../../../components/ui/Table';
import { useCopy } from '../../../hooks/use-copy';
import { formatCopy } from '../../../i18n/copy';
import type { NewsCrawlLog, NewsSource } from '../../../types/domain';
import {
  formatInstantLocal,
  formatInstantUtc,
} from '../../../utils/instant-format';
import { LOGS_PAGE_SIZE, useCrawlLogs } from '../hooks/use-news-admin';
import { newsAdminErrorText } from '../news-admin-errors';
import { crawlTone } from './news-admin-format';

/**
 * The crawl log of one source (SRS 3.11.6): time, status, articles found
 * and inserted, and the error, latest first, a page at a time.
 */
export function CrawlLogDialog({
  source,
  onClose,
}: {
  source: NewsSource | null;
  onClose: () => void;
}) {
  const copy = useCopy();
  const n = copy.newsAdmin;
  const [page, setPage] = useState(1);
  const [shown, setShown] = useState(source?.id ?? null);
  // Another source opens on its first page.
  if ((source?.id ?? null) !== shown) {
    setShown(source?.id ?? null);
    setPage(1);
  }
  const logs = useCrawlLogs(source?.id ?? null, page);
  const pages = Math.max(
    1,
    Math.ceil((logs.data?.total ?? 0) / LOGS_PAGE_SIZE),
  );

  const columns: Column<NewsCrawlLog>[] = [
    {
      id: 'started',
      header: n.colStarted,
      render: (log) => (
        <time
          dateTime={log.startedAt}
          title={formatInstantUtc(log.startedAt)}
          className="font-mono"
        >
          {formatInstantLocal(log.startedAt)}
        </time>
      ),
    },
    {
      id: 'status',
      header: n.colStatus,
      render: (log) => (
        <Badge tone={crawlTone[log.status]}>{n[`crawl${log.status}`]}</Badge>
      ),
    },
    {
      id: 'result',
      header: n.colResult,
      render: (log) =>
        log.articlesFound === null
          ? '--'
          : formatCopy(n.crawlCounts, {
              inserted: log.articlesInserted ?? 0,
              found: log.articlesFound,
            }),
    },
    {
      id: 'error',
      header: n.colError,
      render: (log) => (
        <span className="block max-w-[280px] text-[11px] whitespace-normal text-muted-dim">
          {log.errorMessage ?? '--'}
        </span>
      ),
    },
  ];

  return (
    <Dialog
      open={source !== null}
      onOpenChange={(next) => !next && onClose()}
      title={source ? formatCopy(n.logTitle, { name: source.sourceName }) : ''}
      size="lg"
      footer={
        <Button variant="secondary" onClick={onClose}>
          {n.close}
        </Button>
      }
    >
      {logs.isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : logs.isError ? (
        <ErrorState
          message={newsAdminErrorText(copy, logs.error)}
          onRetry={() => void logs.refetch()}
        />
      ) : (
        <>
          <Table
            caption={n.logCaption}
            columns={columns}
            rows={logs.data.items}
            rowKey={(log) => log.id}
            emptyMessage={n.logEmpty}
          />
          {pages > 1 && (
            <div className="mt-3 flex items-center justify-end gap-2 text-xs text-muted-dim">
              <span>{formatCopy(n.pageOf, { page, pages })}</span>
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                {n.previous}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= pages}
                onClick={() => setPage((p) => p + 1)}
              >
                {n.next}
              </Button>
            </div>
          )}
        </>
      )}
    </Dialog>
  );
}
