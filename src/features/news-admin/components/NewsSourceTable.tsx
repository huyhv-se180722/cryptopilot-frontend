import { History, Pencil, RefreshCw, Trash2 } from 'lucide-react';
import { Badge } from '../../../components/ui/Badge';
import { Table, type Column } from '../../../components/ui/Table';
import { useCopy } from '../../../hooks/use-copy';
import { formatCopy } from '../../../i18n/copy';
import type { NewsSource } from '../../../types/domain';
import {
  formatInstantLocal,
  formatInstantUtc,
} from '../../../utils/instant-format';
import { crawlTone } from './news-admin-format';

const actionClass =
  'inline-flex size-8 items-center justify-center rounded-lg text-muted-dim hover:bg-raised-hover hover:text-fg-2';

function When({ iso }: { iso: string }) {
  return (
    <time dateTime={iso} title={formatInstantUtc(iso)} className="font-mono">
      {formatInstantLocal(iso)}
    </time>
  );
}

/**
 * SCR-41 sources (UC-49): name and feed, interval, on or off, the last
 * crawl and its result, the next due time, and per source crawl now, its
 * crawl log, edit and delete.
 */
export function NewsSourceTable({
  sources,
  onCrawl,
  onLogs,
  onEdit,
  onDelete,
}: {
  sources: readonly NewsSource[];
  onCrawl: (source: NewsSource) => void;
  onLogs: (source: NewsSource) => void;
  onEdit: (source: NewsSource) => void;
  onDelete: (source: NewsSource) => void;
}) {
  const n = useCopy().newsAdmin;
  const columns: Column<NewsSource>[] = [
    {
      id: 'name',
      header: n.colName,
      render: (s) => (
        <span className="block max-w-[320px] whitespace-normal">
          <span className="line-clamp-1 font-medium text-fg">
            {s.sourceName}
          </span>
          <span className="line-clamp-1 font-mono text-[11px] text-muted-dim">
            {s.feedUrl}
          </span>
        </span>
      ),
    },
    {
      id: 'interval',
      header: n.colInterval,
      render: (s) => formatCopy(n.everyMinutes, { n: s.crawlIntervalMinutes }),
    },
    {
      id: 'status',
      header: n.colStatus,
      render: (s) => (
        <Badge tone={s.active ? 'success' : 'neutral'} withDot>
          {s.active ? n.active : n.inactive}
        </Badge>
      ),
    },
    {
      id: 'last',
      header: n.colLastCrawl,
      render: (s) =>
        s.lastCrawl ? (
          <span className="flex flex-col gap-0.5">
            <When iso={s.lastCrawl.startedAt} />
            <span className="flex items-center gap-1.5">
              <Badge tone={crawlTone[s.lastCrawl.status]}>
                {n[`crawl${s.lastCrawl.status}`]}
              </Badge>
              {s.lastCrawl.articlesFound !== null && (
                <span className="text-[11px] text-muted-dim">
                  {formatCopy(n.crawlCounts, {
                    inserted: s.lastCrawl.articlesInserted ?? 0,
                    found: s.lastCrawl.articlesFound,
                  })}
                </span>
              )}
            </span>
          </span>
        ) : (
          n.never
        ),
    },
    {
      id: 'next',
      header: n.colNextCrawl,
      render: (s) => (s.nextCrawlAt ? <When iso={s.nextCrawlAt} /> : '--'),
    },
    {
      id: 'actions',
      header: n.colActions,
      render: (s) => (
        <span className="flex items-center gap-1">
          <button
            type="button"
            aria-label={formatCopy(n.crawlNowFor, { name: s.sourceName })}
            title={n.crawlConfirm}
            onClick={() => onCrawl(s)}
            className={actionClass + ' hover:text-primary'}
          >
            <RefreshCw size={14} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={formatCopy(n.logsFor, { name: s.sourceName })}
            title={n.logs}
            onClick={() => onLogs(s)}
            className={actionClass}
          >
            <History size={14} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={formatCopy(n.editFor, { name: s.sourceName })}
            title={n.editTitle}
            onClick={() => onEdit(s)}
            className={actionClass}
          >
            <Pencil size={14} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={formatCopy(n.deleteFor, { name: s.sourceName })}
            title={n.deleteConfirm}
            onClick={() => onDelete(s)}
            className={actionClass + ' hover:text-negative'}
          >
            <Trash2 size={14} aria-hidden="true" />
          </button>
        </span>
      ),
    },
  ];
  return (
    <Table
      caption={n.caption}
      columns={columns}
      rows={sources}
      rowKey={(s) => s.id}
    />
  );
}
